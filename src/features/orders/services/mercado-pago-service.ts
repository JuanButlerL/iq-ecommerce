import crypto from "node:crypto";
import { Prisma, type Order, OrderStatus, PaymentProvider, PaymentWebhookProcessingStatus } from "@prisma/client";
import type { PaymentResponse } from "mercadopago/dist/clients/payment/commonTypes";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  getMercadoPagoNotificationUrl,
  getMercadoPagoPaymentClient,
  getMercadoPagoPreferenceClient,
  getMercadoPagoReturnUrl,
  getMercadoPagoStatementDescriptor,
  getMercadoPagoWebhookSecret,
  isMercadoPagoPublicSiteUrl,
  preferMercadoPagoSandboxUrl,
} from "@/lib/integrations/mercadopago/client";
import { getMercadoPagoStatusLabel, mapMercadoPagoStatusToInternal } from "@/lib/integrations/mercadopago/status";
import { syncOrder } from "@/features/orders/services/sync-service";

type MercadoPagoOrderRecord = Prisma.OrderGetPayload<{
  include: {
    items: true;
    mercadoPagoPreference: true;
    mercadoPagoPayments: {
      orderBy: {
        createdAt: "desc";
      };
    };
    paymentWebhookEvents: {
      orderBy: {
        createdAt: "desc";
      };
    };
  };
}>;

type MercadoPagoWebhookPayload = {
  id?: number | string;
  live_mode?: boolean;
  type?: string;
  action?: string;
  data?: {
    id?: string | number;
  };
};

export async function ensureMercadoPagoPreference(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      mercadoPagoPreference: true,
    },
  });

  if (!order) {
    throw new AppError("Pedido no encontrado.", 404);
  }

  if (order.paymentMethod !== "MERCADO_PAGO") {
    throw new AppError("El pedido no corresponde a Mercado Pago.", 400);
  }

  if (order.mercadoPagoPreference) {
    return {
      preferenceId: order.mercadoPagoPreference.preferenceId,
      initPoint: resolveInitPoint(order.mercadoPagoPreference.initPoint, order.mercadoPagoPreference.sandboxInitPoint),
      redirectPath: `/checkout/mercado-pago/${order.publicOrderNumber}`,
      externalReference: order.mercadoPagoPreference.externalReference,
    };
  }

  const preference = await getMercadoPagoPreferenceClient().create({
    body: {
      items: [
        {
          id: order.id,
          title: `Pedido IQ Kids ${order.publicOrderNumber}`,
          description: buildOrderDescription(order),
          quantity: 1,
          currency_id: order.currency,
          unit_price: order.totalArs,
        },
      ],
      payer: {
        name: order.customerFirstName,
        surname: order.customerLastName,
        email: order.customerEmail,
        phone: {
          number: order.customerPhone,
        },
      },
      external_reference: order.publicOrderNumber,
      back_urls: {
        success: getMercadoPagoReturnUrl(order.publicOrderNumber),
        pending: getMercadoPagoReturnUrl(order.publicOrderNumber),
        failure: getMercadoPagoReturnUrl(order.publicOrderNumber),
      },
      auto_return: isMercadoPagoPublicSiteUrl() ? "approved" : undefined,
      binary_mode: false,
      notification_url: getMercadoPagoNotificationUrl(),
      statement_descriptor: getMercadoPagoStatementDescriptor(),
      expires: Boolean(order.reservationExpiresAt),
      expiration_date_to: order.reservationExpiresAt?.toISOString(),
      metadata: {
        order_id: order.id,
        order_number: order.publicOrderNumber,
        source: "web",
      },
    },
    requestOptions: {
      idempotencyKey: `mp-pref-${order.id}`,
    },
  });

  if (!preference.id || !preference.init_point) {
    throw new AppError("No pudimos iniciar Mercado Pago.", 502);
  }

  const preferenceId = preference.id;
  const initPoint = preference.init_point;

  await prisma.$transaction(async (tx) => {
    await tx.mercadoPagoPreference.create({
      data: {
        orderId: order.id,
        preferenceId,
        externalReference: order.publicOrderNumber,
        initPoint,
        sandboxInitPoint: preference.sandbox_init_point,
        expiresAt: preference.expiration_date_to ? new Date(preference.expiration_date_to) : null,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentInitiatedAt: order.paymentInitiatedAt ?? new Date(),
        paymentProviderStatus: "pending",
        paymentProviderStatusDetail: "waiting_checkout",
      },
    });
  });

  return {
    preferenceId,
    initPoint: resolveInitPoint(initPoint, preference.sandbox_init_point),
    redirectPath: `/checkout/mercado-pago/${order.publicOrderNumber}`,
    externalReference: order.publicOrderNumber,
  };
}

export async function getMercadoPagoOrderView(orderNumber: string) {
  return prisma.order.findUnique({
    where: { publicOrderNumber: orderNumber },
    include: {
      items: true,
      mercadoPagoPreference: true,
      mercadoPagoPayments: {
        orderBy: {
          createdAt: "desc",
        },
      },
      paymentWebhookEvents: {
        where: {
          provider: PaymentProvider.MERCADO_PAGO,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

export async function refreshMercadoPagoPaymentFromReturn(orderNumber: string, paymentId?: string | null) {
  if (!paymentId) {
    return null;
  }

  const order = await prisma.order.findUnique({
    where: { publicOrderNumber: orderNumber },
    select: {
      id: true,
      publicOrderNumber: true,
      paymentMethod: true,
    },
  });

  if (!order || order.paymentMethod !== "MERCADO_PAGO") {
    return null;
  }

  const payment = await fetchMercadoPagoPayment(paymentId);

  if (payment.external_reference !== order.publicOrderNumber && payment.metadata?.order_id !== order.id) {
    throw new AppError("La respuesta de Mercado Pago no coincide con el pedido.", 400);
  }

  return upsertMercadoPagoPayment(payment, "return");
}

export async function handleMercadoPagoWebhook(request: Request) {
  const url = new URL(request.url);
  const rawBody = await request.text();
  const payload = parseWebhookPayload(rawBody);
  const resourceId = getWebhookResourceId(payload, url);
  const eventId = getWebhookEventId(payload, resourceId);
  const headers = Object.fromEntries(request.headers.entries());
  const signature = parseMercadoPagoSignature(headers["x-signature"]);
  const requestId = headers["x-request-id"] ?? null;

  validateWebhookSignature({
    rawBody,
    requestId,
    resourceId,
    signature,
  });

  const eventRecord = await createWebhookEvent({
    eventId,
    payload,
    resourceId,
    requestId,
    signature,
    url,
    headers,
  });

  if (!eventRecord) {
    return { ok: true, duplicated: true };
  }

  try {
    const topic = resolveWebhookTopic(payload, url);

    if (topic !== "payment" || !resourceId) {
      await prisma.paymentWebhookEvent.update({
        where: { id: eventRecord.id },
        data: {
          processingStatus: PaymentWebhookProcessingStatus.IGNORED,
          processedAt: new Date(),
        },
      });

      return { ok: true, ignored: true };
    }

    const payment = await fetchMercadoPagoPayment(resourceId);
    const result = await upsertMercadoPagoPayment(payment, "webhook", eventRecord.id);

    await prisma.paymentWebhookEvent.update({
      where: { id: eventRecord.id },
      data: {
        orderId: result?.orderId ?? null,
        paymentReference: payment.id ? String(payment.id) : null,
        processingStatus: PaymentWebhookProcessingStatus.PROCESSED,
        processedAt: new Date(),
      },
    });

    return { ok: true, orderId: result?.orderId ?? null };
  } catch (error) {
    await prisma.paymentWebhookEvent.update({
      where: { id: eventRecord.id },
      data: {
        processingStatus: PaymentWebhookProcessingStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : "Webhook error",
      },
    });

    throw error;
  }
}

export function getMercadoPagoCheckoutCopy(order: Pick<Order, "paymentProviderStatus" | "paymentProviderStatusDetail">) {
  return getMercadoPagoStatusLabel(order.paymentProviderStatus ?? undefined, order.paymentProviderStatusDetail ?? undefined);
}

async function fetchMercadoPagoPayment(paymentId: string | number) {
  return getMercadoPagoPaymentClient().get({
    id: paymentId,
  });
}

async function upsertMercadoPagoPayment(
  payment: PaymentResponse,
  source: "webhook" | "return",
  webhookEventId?: string,
) {
  const order = await findOrderForMercadoPagoPayment(payment);

  if (!order) {
    if (source === "webhook") {
      return null;
    }

    throw new AppError("No encontramos el pedido asociado al pago.", 404);
  }

  const mapped = mapMercadoPagoStatusToInternal(payment.status, payment.status_detail);
  const nextOrderStatus = resolveNextOrderStatus(order.orderStatus, mapped.orderStatus);
  const nextPaymentStatus = resolveNextPaymentStatus(order, mapped.paymentStatus);
  const paidAt = payment.date_approved ? new Date(payment.date_approved) : mapped.paidAt ?? order.paidAt;

  await prisma.$transaction(async (tx) => {
    await tx.mercadoPagoPayment.upsert({
      where: {
        mercadoPagoPaymentId: String(payment.id),
      },
      update: {
        merchantOrderId: payment.order?.id ? String(payment.order.id) : null,
        preferenceId: extractPreferenceId(payment),
        externalReference: payment.external_reference ?? null,
        liveMode: payment.live_mode ?? null,
        status: payment.status ?? "pending",
        statusDetail: payment.status_detail ?? null,
        transactionAmount: payment.transaction_amount ? Math.round(payment.transaction_amount) : null,
        currencyId: payment.currency_id ?? null,
        payerEmail: payment.payer?.email ?? null,
        dateCreated: payment.date_created ? new Date(payment.date_created) : null,
        dateApproved: payment.date_approved ? new Date(payment.date_approved) : null,
        dateLastUpdated: payment.date_last_updated ? new Date(payment.date_last_updated) : null,
        rawData: toJsonValue(payment),
      },
      create: {
        orderId: order.id,
        mercadoPagoPaymentId: String(payment.id),
        merchantOrderId: payment.order?.id ? String(payment.order.id) : null,
        preferenceId: extractPreferenceId(payment),
        externalReference: payment.external_reference ?? null,
        liveMode: payment.live_mode ?? null,
        status: payment.status ?? "pending",
        statusDetail: payment.status_detail ?? null,
        transactionAmount: payment.transaction_amount ? Math.round(payment.transaction_amount) : null,
        currencyId: payment.currency_id ?? null,
        payerEmail: payment.payer?.email ?? null,
        dateCreated: payment.date_created ? new Date(payment.date_created) : null,
        dateApproved: payment.date_approved ? new Date(payment.date_approved) : null,
        dateLastUpdated: payment.date_last_updated ? new Date(payment.date_last_updated) : null,
        rawData: toJsonValue(payment),
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentProviderReference: payment.id ? String(payment.id) : order.paymentProviderReference,
        paymentProviderStatus: payment.status ?? order.paymentProviderStatus,
        paymentProviderStatusDetail: payment.status_detail ?? order.paymentProviderStatusDetail,
        paymentStatus: nextPaymentStatus,
        orderStatus: nextOrderStatus,
        paidAt: nextPaymentStatus === "PAID" ? paidAt : order.paidAt,
      },
    });

    if (shouldAppendStatusHistory(order, nextOrderStatus, nextPaymentStatus, payment)) {
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: nextOrderStatus,
          note: buildMercadoPagoStatusNote(payment, source),
          changedBy: webhookEventId ? "mercadopago:webhook" : "mercadopago:return",
        },
      });
    }

    if (webhookEventId) {
      await tx.paymentWebhookEvent.update({
        where: { id: webhookEventId },
        data: {
          orderId: order.id,
        },
      });
    }
  });

  if (hasOrderSyncRelevantChanges(order, nextOrderStatus, nextPaymentStatus, payment)) {
    await syncOrder(order.id).catch(async (syncError) => {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          syncLastError: syncError instanceof Error ? syncError.message : "Sync error",
        },
      });
    });
  }

  return {
    orderId: order.id,
    orderNumber: order.publicOrderNumber,
  };
}

async function findOrderForMercadoPagoPayment(payment: PaymentResponse): Promise<MercadoPagoOrderRecord | null> {
  const metadataOrderId = payment.metadata?.order_id ? String(payment.metadata.order_id) : null;
  const orderNumber = payment.external_reference ? String(payment.external_reference) : null;
  const paymentId = payment.id ? String(payment.id) : null;
  const preferenceId = extractPreferenceId(payment);

  if (metadataOrderId) {
    const byId = await getMercadoPagoOrderRecord({
      id: metadataOrderId,
    });

    if (byId) {
      return byId;
    }
  }

  if (orderNumber) {
    const byOrderNumber = await getMercadoPagoOrderRecord({
      publicOrderNumber: orderNumber,
    });

    if (byOrderNumber) {
      return byOrderNumber;
    }
  }

  if (paymentId) {
    const knownPayment = await prisma.mercadoPagoPayment.findUnique({
      where: {
        mercadoPagoPaymentId: paymentId,
      },
      include: {
        order: {
          include: {
            items: true,
            mercadoPagoPreference: true,
            mercadoPagoPayments: {
              orderBy: {
                createdAt: "desc",
              },
            },
            paymentWebhookEvents: {
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
      },
    });

    if (knownPayment?.order) {
      return knownPayment.order;
    }
  }

  if (preferenceId) {
    const knownPreference = await prisma.mercadoPagoPreference.findUnique({
      where: {
        preferenceId,
      },
      include: {
        order: {
          include: {
            items: true,
            mercadoPagoPreference: true,
            mercadoPagoPayments: {
              orderBy: {
                createdAt: "desc",
              },
            },
            paymentWebhookEvents: {
              orderBy: {
                createdAt: "desc",
              },
            },
          },
        },
      },
    });

    if (knownPreference?.order) {
      return knownPreference.order;
    }
  }

  return null;
}

function buildOrderDescription(order: { items: Array<{ productNameSnapshot: string; quantity: number }> }) {
  return order.items
    .slice(0, 3)
    .map((item) => `${item.productNameSnapshot} x${item.quantity}`)
    .join(" · ");
}

function resolveInitPoint(initPoint: string, sandboxInitPoint?: string | null) {
  return preferMercadoPagoSandboxUrl() && sandboxInitPoint ? sandboxInitPoint : initPoint;
}

function parseWebhookPayload(rawBody: string): MercadoPagoWebhookPayload {
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody) as MercadoPagoWebhookPayload;
  } catch {
    throw new AppError("Webhook invalido.", 400);
  }
}

function getWebhookResourceId(payload: MercadoPagoWebhookPayload, url: URL) {
  return String(payload.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
}

function getWebhookEventId(payload: MercadoPagoWebhookPayload, resourceId: string) {
  if (payload.id != null) {
    return String(payload.id);
  }

  return `fallback:${payload.type ?? "unknown"}:${resourceId}`;
}

function resolveWebhookTopic(payload: MercadoPagoWebhookPayload, url: URL) {
  return String(payload.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "");
}

function parseMercadoPagoSignature(value?: string | null) {
  if (!value) {
    throw new AppError("Webhook sin firma.", 401);
  }

  const parts = value.split(",").map((entry) => entry.trim());
  const ts = parts.find((entry) => entry.startsWith("ts="))?.slice(3) ?? "";
  const v1 = parts.find((entry) => entry.startsWith("v1="))?.slice(3) ?? "";

  if (!ts || !v1) {
    throw new AppError("Firma de webhook invalida.", 401);
  }

  return { ts, v1 };
}

function validateWebhookSignature({
  requestId,
  resourceId,
  signature,
}: {
  rawBody: string;
  requestId: string | null;
  resourceId: string;
  signature: { ts: string; v1: string };
}) {
  if (!requestId || !resourceId) {
    throw new AppError("Webhook incompleto.", 401);
  }

  const manifest = `id:${resourceId};request-id:${requestId};ts:${signature.ts};`;
  const expected = crypto.createHmac("sha256", getMercadoPagoWebhookSecret()).update(manifest).digest("hex").toLowerCase();

  if (expected !== signature.v1.toLowerCase()) {
    throw new AppError("Firma de webhook no valida.", 401);
  }
}

async function createWebhookEvent({
  eventId,
  payload,
  resourceId,
  requestId,
  signature,
  url,
  headers,
}: {
  eventId: string;
  payload: MercadoPagoWebhookPayload;
  resourceId: string;
  requestId: string | null;
  signature: { ts: string; v1: string };
  url: URL;
  headers: Record<string, string>;
}) {
  try {
    return await prisma.paymentWebhookEvent.create({
      data: {
        provider: PaymentProvider.MERCADO_PAGO,
        webhookEventId: eventId,
        topic: resolveWebhookTopic(payload, url),
        action: payload.action ?? null,
        resourceId: resourceId || null,
        requestId,
        signatureTs: signature.ts,
        signatureV1: signature.v1,
        queryParams: toJsonValue(Object.fromEntries(url.searchParams.entries())),
        headers: toJsonValue(headers),
        payload: toJsonValue(payload),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }

    throw error;
  }
}

function buildMercadoPagoStatusNote(payment: PaymentResponse, source: "webhook" | "return") {
  const label = getMercadoPagoStatusLabel(payment.status, payment.status_detail);
  const reference = payment.id ? `Pago ${payment.id}` : "Pago sin referencia";

  return `${label} desde Mercado Pago (${source}). ${reference}.`;
}

function resolveNextOrderStatus(current: OrderStatus, next: OrderStatus) {
  if (current === OrderStatus.PREPARING || current === OrderStatus.SHIPPED || current === OrderStatus.DELIVERED) {
    return current;
  }

  if (current === OrderStatus.PAID && next === OrderStatus.PENDING_PAYMENT) {
    return current;
  }

  return next;
}

function resolveNextPaymentStatus(
  order: Pick<Order, "paymentStatus" | "paidAt">,
  nextPaymentStatus: Order["paymentStatus"],
) {
  if (order.paymentStatus === "PAID" && nextPaymentStatus === "PENDING") {
    return order.paymentStatus;
  }

  return nextPaymentStatus;
}

function shouldAppendStatusHistory(
  order: Pick<Order, "orderStatus" | "paymentStatus" | "paymentProviderStatus" | "paymentProviderStatusDetail">,
  nextOrderStatus: OrderStatus,
  nextPaymentStatus: Order["paymentStatus"],
  payment: PaymentResponse,
) {
  return (
    order.orderStatus !== nextOrderStatus ||
    order.paymentStatus !== nextPaymentStatus ||
    order.paymentProviderStatus !== payment.status ||
    order.paymentProviderStatusDetail !== payment.status_detail
  );
}

function hasOrderSyncRelevantChanges(
  order: Pick<Order, "orderStatus" | "paymentStatus" | "paymentProviderStatus" | "paymentProviderStatusDetail">,
  nextOrderStatus: OrderStatus,
  nextPaymentStatus: Order["paymentStatus"],
  payment: PaymentResponse,
) {
  return shouldAppendStatusHistory(order, nextOrderStatus, nextPaymentStatus, payment);
}

function extractPreferenceId(payment: PaymentResponse) {
  const metadataPreferenceId =
    payment.metadata && typeof payment.metadata === "object" && "preference_id" in payment.metadata
      ? String(payment.metadata.preference_id)
      : null;

  return metadataPreferenceId ?? null;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getMercadoPagoOrderRecord(where: Prisma.OrderWhereUniqueInput) {
  return prisma.order.findUnique({
    where,
    include: {
      items: true,
      mercadoPagoPreference: true,
      mercadoPagoPayments: {
        orderBy: {
          createdAt: "desc",
        },
      },
      paymentWebhookEvents: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}
