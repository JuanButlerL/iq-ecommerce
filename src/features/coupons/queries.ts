import { cache } from "react";
import { OrderStatus, PaymentStatus } from "@prisma/client";

import { assertCouponIsApplicable, buildCouponSummary, normalizeCouponCode } from "@/features/coupons/lib/coupon-pricing";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { couponPreviewSchema } from "@/lib/validations/coupon";

const confirmedCouponPaymentStatuses = [PaymentStatus.PAID, PaymentStatus.PROOF_UPLOADED];
const cancelledCouponOrderStatuses = [OrderStatus.CANCELLED, OrderStatus.EXPIRED];

export const getCoupons = cache(async () => {
  return prisma.coupon.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: {
          orders: {
            where: {
              paymentStatus: { in: confirmedCouponPaymentStatuses },
              orderStatus: { notIn: cancelledCouponOrderStatuses },
            },
          },
        },
      },
    },
  });
});

export async function getCouponsForClient() {
  const coupons = await getCoupons();

  return coupons.map((coupon) => ({
    ...coupon,
    fixedDiscountArs: coupon.fixedDiscountArs ?? null,
    discountPercentage: coupon.discountPercentage == null ? null : Number(coupon.discountPercentage),
  }));
}

function normalizeTaxId(value?: string | null) {
  return value?.replace(/\D/g, "") ?? "";
}

export async function assertCouponUsageIsAvailable(
  coupon: {
    id: string;
    code: string;
    usageType: string;
  },
  taxId?: string | null,
) {
  if (coupon.usageType === "UNLIMITED") {
    return;
  }

  if (coupon.usageType === "SINGLE_USE") {
    const usedCount = await prisma.order.count({
      where: {
        couponId: coupon.id,
        paymentStatus: { in: confirmedCouponPaymentStatuses },
        orderStatus: { notIn: cancelledCouponOrderStatuses },
      },
    });

    if (usedCount > 0) {
      throw new AppError(`El cupón ${coupon.code} ya fue utilizado.`, 400);
    }

    return;
  }

  const normalizedTaxId = normalizeTaxId(taxId);

  if (!normalizedTaxId) {
    return;
  }

  const previousOrders = await prisma.order.findMany({
    where: {
      couponId: coupon.id,
      paymentStatus: { in: confirmedCouponPaymentStatuses },
      orderStatus: { notIn: cancelledCouponOrderStatuses },
      customerTaxId: { not: null },
    },
    select: {
      customerTaxId: true,
    },
  });

  if (previousOrders.some((order) => normalizeTaxId(order.customerTaxId) === normalizedTaxId)) {
    throw new AppError(`El cupón ${coupon.code} ya fue utilizado con ese DNI.`, 400);
  }
}

export async function getCouponPreview(payload: unknown) {
  const parsed = couponPreviewSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Cupón inválido.", 400);
  }

  const couponCode = normalizeCouponCode(parsed.data.code);
  const coupon = await prisma.coupon.findUnique({
    where: { code: couponCode },
  });

  assertCouponIsApplicable(coupon, couponCode);

  if (!coupon) {
    throw new AppError(`El cupón ${couponCode} no existe o no está activo.`, 400);
  }

  await assertCouponUsageIsAvailable(coupon, parsed.data.taxId);

  return buildCouponSummary(coupon, parsed.data.subtotalArs);
}
