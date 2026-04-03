import { OrderStatus, PaymentStatus, type Order, type OrderItem } from "@prisma/client";

import { env, requireServerEnv } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";

const MERCADO_PAGO_API_BASE = "https://api.mercadopago.com";

type OrderForMercadoPago = Order & {
  items: OrderItem[];
};

type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MercadoPagoPaymentResponse = {
  id: number;
  status?: string;
  status_detail?: string;
  date_approved?: string | null;
  date_last_updated?: string | null;
  external_reference?: string | null;
};

type MercadoPagoPaymentSnapshot = {
  providerRef: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  statusDetail: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  lastCheckedAt: Date;
};

export function isMercadoPagoEnabled() {
  return env.hasMercadoPago;
}

export async function createMercadoPagoPreference(order: OrderForMercadoPago, storeName: string) {
  if (!isMercadoPagoEnabled()) {
    throw new AppError("Mercado Pago no est\u00e1 configurado en este entorno.", 503);
  }

  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const confirmationUrl = `${siteUrl}/checkout/confirmacion/${order.publicOrderNumber}`;
  const notificationUrl = `${siteUrl}/api/payments/mercado-pago/webhook`;
  const canUseReturnUrls = isPublicMercadoPagoReturnUrl(siteUrl);

  const statementDescriptor = storeName.replace(/[^a-z0-9 ]/gi, "").trim().slice(0, 16) || "IQ KIDS";

  const response = await mercadoPagoFetch<MercadoPagoPreferenceResponse>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      external_reference: order.publicOrderNumber,
      ...(canUseReturnUrls
        ? {
            notification_url: notificationUrl,
            back_urls: {
              success: confirmationUrl,
              pending: confirmationUrl,
              failure: confirmationUrl,
            },
            auto_return: "approved",
          }
        : {}),
      payer: {
        name: order.customerFirstName,
        surname: order.customerLastName,
        email: order.customerEmail,
        phone: {
          number: order.customerPhone,
        },
      },
      metadata: {
        order_id: order.id,
        order_number: order.publicOrderNumber,
      },
      statement_descriptor: statementDescriptor,
      items: order.items.map((item) => ({
        id: item.productId ?? item.id,
        title: item.productNameSnapshot,
        quantity: item.quantity,
        currency_id: "ARS",
        unit_price: item.unitPriceArs,
      })),
    }),
  });

  const checkoutUrl = response.sandbox_init_point || response.init_point;

  if (!checkoutUrl) {
    throw new AppError("Mercado Pago no devolvi\u00f3 una URL de pago.", 502);
  }

  return {
    preferenceId: response.id,
    checkoutUrl,
  };
}

export async function getMercadoPagoPayment(paymentId: string | number) {
  if (!isMercadoPagoEnabled()) {
    throw new AppError("Mercado Pago no est\u00e1 configurado en este entorno.", 503);
  }

  return mercadoPagoFetch<MercadoPagoPaymentResponse>(`/v1/payments/${paymentId}`, {
    method: "GET",
  });
}

export function mapMercadoPagoPayment(payment: MercadoPagoPaymentResponse): MercadoPagoPaymentSnapshot {
  const status = payment.status ?? "pending";
  const statusDetail = payment.status_detail ?? null;
  const approvedAt = payment.date_approved ? new Date(payment.date_approved) : null;
  const lastCheckedAt = payment.date_last_updated ? new Date(payment.date_last_updated) : new Date();

  if (status === "approved") {
    return {
      providerRef: String(payment.id),
      paymentStatus: PaymentStatus.PAID,
      orderStatus: OrderStatus.PAID,
      statusDetail,
      approvedAt,
      rejectedAt: null,
      lastCheckedAt,
    };
  }

  if (["rejected", "cancelled", "charged_back"].includes(status)) {
    return {
      providerRef: String(payment.id),
      paymentStatus: status === "cancelled" ? PaymentStatus.CANCELLED : PaymentStatus.REJECTED,
      orderStatus: OrderStatus.PENDING_PAYMENT,
      statusDetail,
      approvedAt: null,
      rejectedAt: new Date(),
      lastCheckedAt,
    };
  }

  return {
    providerRef: String(payment.id),
    paymentStatus: PaymentStatus.PENDING,
    orderStatus: OrderStatus.PENDING_PAYMENT,
    statusDetail,
    approvedAt: null,
    rejectedAt: null,
    lastCheckedAt,
  };
}

function isPublicMercadoPagoReturnUrl(siteUrl: string) {
  try {
    const parsed = new URL(siteUrl);
    const host = parsed.hostname.toLowerCase();

    if (parsed.protocol !== "https:") {
      return false;
    }

    return !["localhost", "127.0.0.1", "0.0.0.0"].includes(host);
  } catch {
    return false;
  }
}

async function mercadoPagoFetch<T>(path: string, init: RequestInit) {
  const accessToken = requireServerEnv("MERCADO_PAGO_ACCESS_TOKEN");
  const response = await fetch(`${MERCADO_PAGO_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { message?: string; cause?: Array<{ description?: string }> })
    | null;

  if (!response.ok || !payload) {
    const details =
      payload?.cause?.map((cause) => cause.description).filter(Boolean).join(" | ") ||
      payload?.message ||
      "Error al comunicarse con Mercado Pago.";

    throw new AppError(details, 502);
  }

  return payload as T;
}
