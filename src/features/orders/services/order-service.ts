import { OrderStatus, PaymentMethod, PaymentStatus, SyncStatus } from "@prisma/client";

import { calculateShippingQuote } from "@/features/cart/lib/shipping";
import { syncOrder } from "@/features/orders/services/sync-service";
import { getStoreSettings } from "@/features/settings/queries";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  createMercadoPagoPreference,
  getMercadoPagoPayment,
  isMercadoPagoEnabled,
  mapMercadoPagoPayment,
} from "@/lib/integrations/payments/mercado-pago";
import { uploadPaymentProof } from "@/lib/storage/payment-proofs";
import type { CheckoutInput } from "@/lib/validations/checkout";
import { generatePublicOrderNumber } from "@/lib/utils/order-number";

export async function createOrderFromCheckout(input: CheckoutInput) {
  const settings = await getStoreSettings();

  if (!settings) {
    throw new AppError("La configuración de tienda no está disponible.", 500);
  }

  if (!settings.isStoreOpen) {
    throw new AppError("La tienda se encuentra momentaneamente cerrada.", 400);
  }

  if (input.paymentMethod === PaymentMethod.MERCADO_PAGO && !isMercadoPagoEnabled()) {
    throw new AppError("Mercado Pago no est\u00e1 disponible en este entorno.", 503);
  }

  const productIds = input.items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      active: true,
      visible: true,
      manualSoldOut: false,
    },
  });

  if (products.length !== productIds.length) {
    throw new AppError("Uno o más productos ya no están disponibles.", 400);
  }

  const subtotalArs = input.items.reduce((accumulator, item) => {
    const product = products.find((entry) => entry.id === item.productId);

    if (!product) {
      return accumulator;
    }

    return accumulator + product.priceArs * item.quantity;
  }, 0);

  const shippingQuote = calculateShippingQuote(subtotalArs, input.province, settings);
  const totalArs = subtotalArs + shippingQuote.shippingArs;
  const publicOrderNumber = generatePublicOrderNumber();
  const reservationExpiresAt = settings.orderReservationHours
    ? new Date(Date.now() + settings.orderReservationHours * 60 * 60 * 1000)
    : null;

  const createdOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        publicOrderNumber,
        customerFirstName: input.firstName,
        customerLastName: input.lastName,
        customerEmail: input.email,
        customerPhone: input.phone,
        customerTaxId: input.taxId || null,
        province: input.province,
        locality: input.locality,
        postalCode: input.postalCode,
        addressLine: input.addressLine,
        addressExtra: input.addressExtra || null,
        notes: input.notes || null,
        subtotalArs,
        shippingArs: shippingQuote.shippingArs,
        totalArs,
        paymentMethod: input.paymentMethod,
        syncStatus: SyncStatus.PENDING,
        reservationExpiresAt,
      },
    });

    await tx.orderItem.createMany({
      data: input.items.map((item) => {
        const product = products.find((entry) => entry.id === item.productId);

        if (!product) {
          throw new AppError("Producto no encontrado.", 400);
        }

        return {
          orderId: order.id,
          productId: product.id,
          productNameSnapshot: product.name,
          unitPriceArs: product.priceArs,
          quantity: item.quantity,
          lineTotalArs: product.priceArs * item.quantity,
        };
      }),
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: OrderStatus.PENDING_PAYMENT,
        note: "Pedido generado desde checkout web.",
        changedBy: "system",
      },
    });

    return {
      ...order,
      shippingQuote,
    };
  });

  if (input.paymentMethod === PaymentMethod.MERCADO_PAGO) {
    const orderForPayment = await prisma.order.findUnique({
      where: { id: createdOrder.id },
      include: {
        items: true,
      },
    });

    if (!orderForPayment) {
      throw new AppError("No pudimos preparar el pago para este pedido.", 500);
    }

    const mercadoPago = await createMercadoPagoPreference(orderForPayment, settings.storeName);

    await prisma.order.update({
      where: { id: createdOrder.id },
      data: {
        paymentPreferenceId: mercadoPago.preferenceId,
        paymentCheckoutUrl: mercadoPago.checkoutUrl,
      },
    });

    createdOrder.paymentPreferenceId = mercadoPago.preferenceId;
    createdOrder.paymentCheckoutUrl = mercadoPago.checkoutUrl;
  }

  await syncOrder(createdOrder.id).catch(async (syncError) => {
    const message = syncError instanceof Error ? syncError.message : "Sync error";

    await prisma.order.update({
      where: { id: createdOrder.id },
      data: {
        syncStatus: SyncStatus.ERROR,
        syncLastError: message,
      },
    });
  });

  return createdOrder;
}

export async function getOrderByNumber(orderNumber: string) {
  return prisma.order.findUnique({
    where: { publicOrderNumber: orderNumber },
    include: {
      items: true,
      paymentProofs: {
        orderBy: {
          uploadedAt: "desc",
        },
      },
      statusHistory: {
        orderBy: {
          createdAt: "desc",
        },
      },
      syncJobs: {
        include: {
          logs: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

type PaymentProofDetails = {
  transferSenderName: string;
  transferDate?: string;
  transferReference?: string;
  customerNote?: string;
};

export async function attachPaymentProof(orderNumber: string, file: File, details: PaymentProofDetails) {
  const order = await prisma.order.findUnique({
    where: { publicOrderNumber: orderNumber },
  });

  if (!order) {
    throw new AppError("Pedido no encontrado.", 404);
  }

  if (order.paymentMethod !== PaymentMethod.BANK_TRANSFER) {
    throw new AppError("Este pedido no requiere comprobante manual.", 400);
  }

  const uploaded = await uploadPaymentProof(file, orderNumber);

  await prisma.$transaction(async (tx) => {
    await tx.paymentProof.create({
      data: {
        orderId: order.id,
        storagePath: uploaded.storagePath,
        publicUrl: uploaded.publicUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        transferSenderName: details.transferSenderName,
        transferDate: details.transferDate ? new Date(details.transferDate) : null,
        transferReference: details.transferReference || null,
        customerNote: details.customerNote || null,
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: PaymentStatus.PROOF_UPLOADED,
        orderStatus: OrderStatus.PROOF_UPLOADED,
        syncStatus: SyncStatus.PENDING,
        syncLastError: null,
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: OrderStatus.PROOF_UPLOADED,
        note: `Comprobante subido por el cliente${details.transferSenderName ? ` · DNI: ${details.transferSenderName}` : ""}${details.transferReference ? ` · Ref: ${details.transferReference}` : ""}.`,
        changedBy: "customer",
      },
    });
  });

  const syncResult = await syncOrder(order.id).catch(async (syncError) => {
    const message = syncError instanceof Error ? syncError.message : "Sync error";

    await prisma.order.update({
      where: { id: order.id },
      data: {
        syncStatus: SyncStatus.ERROR,
        syncLastError: message,
      },
    });

    return null;
  });

  return {
    orderNumber: order.publicOrderNumber,
    syncResult,
  };
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, note?: string) {
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        orderStatus: status,
        paymentStatus:
          status === OrderStatus.PAID
            ? PaymentStatus.PAID
            : status === OrderStatus.PROOF_UPLOADED
              ? PaymentStatus.PROOF_UPLOADED
              : status === OrderStatus.PENDING_PAYMENT
                ? PaymentStatus.PENDING
              : status === OrderStatus.CANCELLED
                ? PaymentStatus.CANCELLED
                : status === OrderStatus.EXPIRED
                  ? PaymentStatus.EXPIRED
                  : undefined,
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status,
        note,
        changedBy: "admin",
      },
    });
  });
}

export async function syncMercadoPagoPaymentByOrderNumber(orderNumber: string, paymentId?: string | null) {
  const order = await prisma.order.findUnique({
    where: { publicOrderNumber: orderNumber },
  });

  if (!order) {
    throw new AppError("Pedido no encontrado.", 404);
  }

  if (order.paymentMethod !== PaymentMethod.MERCADO_PAGO) {
    throw new AppError("El pedido no pertenece a Mercado Pago.", 400);
  }

  const paymentReference = paymentId || order.paymentProviderRef;

  if (!paymentReference) {
    return order;
  }

  return syncMercadoPagoPayment(order.id, paymentReference);
}

export async function syncMercadoPagoPaymentByPaymentId(paymentId: string | number) {
  const payment = await getMercadoPagoPayment(paymentId);
  const orderNumber = payment.external_reference;

  if (!orderNumber) {
    throw new AppError("Mercado Pago no devolvi\u00f3 la referencia del pedido.", 400);
  }

  return syncMercadoPagoPaymentByOrderNumber(orderNumber, String(payment.id));
}

export async function syncMercadoPagoPayment(orderId: string, paymentId: string | number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new AppError("Pedido no encontrado.", 404);
  }

  const payment = await getMercadoPagoPayment(paymentId);
  const snapshot = mapMercadoPagoPayment(payment);

  await prisma.$transaction(async (tx) => {
    const currentOrder = await tx.order.findUnique({
      where: { id: order.id },
    });

    if (!currentOrder) {
      throw new AppError("Pedido no encontrado.", 404);
    }

    const shouldWriteHistory =
      currentOrder.paymentStatus !== snapshot.paymentStatus ||
      currentOrder.paymentProviderRef !== snapshot.providerRef ||
      currentOrder.paymentStatusDetail !== snapshot.statusDetail;

    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: snapshot.paymentStatus,
        orderStatus: snapshot.orderStatus,
        paymentStatusDetail: snapshot.statusDetail,
        paymentProviderRef: snapshot.providerRef,
        paymentApprovedAt: snapshot.approvedAt,
        paymentRejectedAt: snapshot.rejectedAt,
        paymentLastCheckedAt: snapshot.lastCheckedAt,
        syncStatus: SyncStatus.PENDING,
        syncLastError: null,
      },
    });

    if (shouldWriteHistory) {
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: snapshot.orderStatus,
          note: buildMercadoPagoHistoryNote(snapshot.paymentStatus, snapshot.statusDetail, snapshot.providerRef),
          changedBy: "system",
        },
      });
    }
  });

  await syncOrder(order.id).catch(async (syncError) => {
    const message = syncError instanceof Error ? syncError.message : "Sync error";

    await prisma.order.update({
      where: { id: order.id },
      data: {
        syncStatus: SyncStatus.ERROR,
        syncLastError: message,
      },
    });
  });

  return prisma.order.findUnique({
    where: { id: order.id },
    include: {
      items: true,
      paymentProofs: {
        orderBy: {
          uploadedAt: "desc",
        },
      },
      statusHistory: {
        orderBy: {
          createdAt: "desc",
        },
      },
      syncJobs: {
        include: {
          logs: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

function buildMercadoPagoHistoryNote(
  paymentStatus: PaymentStatus,
  statusDetail: string | null,
  providerRef: string,
) {
  const base =
    paymentStatus === PaymentStatus.PAID
      ? `Pago aprobado autom\u00e1ticamente por Mercado Pago.`
      : paymentStatus === PaymentStatus.REJECTED
        ? `Mercado Pago rechaz\u00f3 el pago.`
        : paymentStatus === PaymentStatus.CANCELLED
          ? `Mercado Pago marc\u00f3 el pago como cancelado.`
          : `Mercado Pago inform\u00f3 una actualizaci\u00f3n del pago.`;

  const parts = [base, `ID: ${providerRef}`];

  if (statusDetail) {
    parts.push(`Detalle: ${statusDetail}`);
  }

  return parts.join(" ");
}
