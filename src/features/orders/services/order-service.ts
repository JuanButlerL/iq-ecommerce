import { OrderStatus, PaymentMethod, PaymentProvider, PaymentStatus, Prisma, SyncStatus } from "@prisma/client";

import { getCouponPreview } from "@/features/coupons/queries";
import { syncOrder } from "@/features/orders/services/sync-service";
import { getStoreSettings } from "@/features/settings/queries";
import { calculateShippingQuote } from "@/features/cart/lib/shipping";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { uploadPaymentProof } from "@/lib/storage/payment-proofs";
import type { CheckoutInput } from "@/lib/validations/checkout";
import { buildNextOrderNumber, buildOrderNumberPrefix } from "@/lib/utils/order-number";
import { ensureMercadoPagoPreference } from "@/features/orders/services/mercado-pago-service";

type CreatedCheckoutOrder = {
  id: string;
  publicOrderNumber: string;
  paymentMethod: PaymentMethod;
};

export async function createOrderFromCheckout(input: CheckoutInput) {
  const existingOrder = await prisma.order.findUnique({
    where: {
      checkoutRequestKey: input.checkoutRequestKey,
    },
    select: {
      id: true,
      publicOrderNumber: true,
      paymentMethod: true,
    },
  });

  if (existingOrder) {
    return buildCheckoutResponse({
      id: existingOrder.id,
      publicOrderNumber: existingOrder.publicOrderNumber,
      paymentMethod: existingOrder.paymentMethod,
    });
  }

  const settings = await getStoreSettings();

  if (!settings) {
    throw new AppError("La configuracion de tienda no esta disponible.", 500);
  }

  if (!settings.isStoreOpen) {
    throw new AppError("La tienda se encuentra momentaneamente cerrada.", 400);
  }

  if (input.paymentMethod === PaymentMethod.BANK_TRANSFER && !settings.enableBankTransfer) {
    throw new AppError("La transferencia no esta disponible en este momento.", 400);
  }

  if (input.paymentMethod === PaymentMethod.MERCADO_PAGO && !settings.enableMercadoPago) {
    throw new AppError("Mercado Pago no esta disponible en este momento.", 400);
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
  const coupon = input.couponCode?.trim()
    ? await getCouponPreview({
        code: input.couponCode,
        subtotalArs,
      })
    : null;
  const totalArs = subtotalArs - (coupon?.discountArs ?? 0) + shippingQuote.shippingArs;
  const reservationExpiresAt = settings.orderReservationHours
    ? new Date(Date.now() + settings.orderReservationHours * 60 * 60 * 1000)
    : null;

  let createdOrder: CreatedCheckoutOrder | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      createdOrder = await prisma.$transaction(async (tx) => {
        const orderNumberPrefix = buildOrderNumberPrefix();
        const latestMonthlyOrder = await tx.order.findFirst({
          where: {
            publicOrderNumber: {
              startsWith: orderNumberPrefix,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            publicOrderNumber: true,
          },
        });
        const publicOrderNumber = buildNextOrderNumber(orderNumberPrefix, latestMonthlyOrder?.publicOrderNumber);

        const order = await tx.order.create({
          data: {
            publicOrderNumber,
            checkoutRequestKey: input.checkoutRequestKey,
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
            couponId: coupon?.couponId,
            couponCode: coupon?.couponCode,
            discountPercentage: coupon?.discountPercentage,
            discountArs: coupon?.discountArs ?? 0,
            subtotalArs,
            shippingArs: shippingQuote.shippingArs,
            totalArs,
            paymentMethod: input.paymentMethod,
            paymentProvider:
              input.paymentMethod === PaymentMethod.MERCADO_PAGO
                ? PaymentProvider.MERCADO_PAGO
                : PaymentProvider.MANUAL_TRANSFER,
            paymentProviderStatus: input.paymentMethod === PaymentMethod.MERCADO_PAGO ? "pending" : null,
            paymentProviderStatusDetail:
              input.paymentMethod === PaymentMethod.MERCADO_PAGO ? "waiting_checkout" : null,
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
            note: coupon
              ? `Pedido generado desde checkout web con cupon ${coupon.couponCode} (${coupon.discountPercentage}% de descuento).`
              : "Pedido generado desde checkout web.",
            changedBy: "system",
          },
        });

        return {
          id: order.id,
          publicOrderNumber: order.publicOrderNumber,
          paymentMethod: order.paymentMethod,
        };
      });

      break;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const duplicatedOrder = await prisma.order.findUnique({
          where: {
            checkoutRequestKey: input.checkoutRequestKey,
          },
          select: {
            id: true,
            publicOrderNumber: true,
            paymentMethod: true,
          },
        });

        if (duplicatedOrder) {
          return buildCheckoutResponse({
            id: duplicatedOrder.id,
            publicOrderNumber: duplicatedOrder.publicOrderNumber,
            paymentMethod: duplicatedOrder.paymentMethod,
          });
        }

        if (attempt < 4) {
          continue;
        }
      }

      throw error;
    }
  }

  if (!createdOrder) {
    throw new AppError("No pudimos generar el numero de pedido.", 500, false);
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

  return buildCheckoutResponse(createdOrder);
}

export async function getOrderByNumber(orderNumber: string) {
  return prisma.order.findUnique({
    where: { publicOrderNumber: orderNumber },
    include: {
      coupon: true,
      items: true,
      mercadoPagoPreference: true,
      mercadoPagoPayments: {
        orderBy: {
          createdAt: "desc",
        },
      },
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

async function buildCheckoutResponse(order: CreatedCheckoutOrder) {
  if (order.paymentMethod === PaymentMethod.MERCADO_PAGO) {
    const mercadoPago = await ensureMercadoPagoPreference(order.id);

    return {
      id: order.id,
      publicOrderNumber: order.publicOrderNumber,
      paymentMethod: order.paymentMethod,
      mercadoPago,
    };
  }

  return {
    id: order.id,
    publicOrderNumber: order.publicOrderNumber,
    paymentMethod: order.paymentMethod,
  };
}
