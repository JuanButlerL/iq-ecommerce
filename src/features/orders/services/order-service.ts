import { OrderStatus, PaymentStatus, SyncStatus } from "@prisma/client";

import { calculateShippingQuote } from "@/features/cart/lib/shipping";
import { syncOrder } from "@/features/orders/services/sync-service";
import { getStoreSettings } from "@/features/settings/queries";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { uploadPaymentProof } from "@/lib/storage/payment-proofs";
import type { CheckoutInput } from "@/lib/validations/checkout";
import { generatePublicOrderNumber } from "@/lib/utils/order-number";

export async function createOrderFromCheckout(input: CheckoutInput) {
  const settings = await getStoreSettings();

  if (!settings) {
    throw new AppError("La configuracion de tienda no esta disponible.", 500);
  }

  if (!settings.isStoreOpen) {
    throw new AppError("La tienda se encuentra momentaneamente cerrada.", 400);
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
    throw new AppError("Uno o mas productos ya no estan disponibles.", 400);
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

  return prisma.$transaction(async (tx) => {
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
              : status === OrderStatus.CANCELLED
                ? PaymentStatus.CANCELLED
                : status === OrderStatus.EXPIRED
                  ? PaymentStatus.EXPIRED
                  : status === OrderStatus.PENDING_PAYMENT
                    ? PaymentStatus.PENDING
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
