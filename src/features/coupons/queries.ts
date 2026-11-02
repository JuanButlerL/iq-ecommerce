import { cache } from "react";
import { OrderStatus, PaymentStatus } from "@prisma/client";

import {
  applyProductDiscount,
  COUPON_EXCLUDES_DISCOUNTED_MESSAGE,
  getCouponEligibleLines,
} from "@/features/catalog/lib/product-discount";
import {
  assertCouponIsApplicable,
  buildCouponSummary,
  normalizeCouponCode,
  type CouponLine,
} from "@/features/coupons/lib/coupon-pricing";
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

/** Products the coupon admin can mark as packs for NxM coupons. */
export async function getCouponProductOptions() {
  return prisma.product.findMany({
    select: { id: true, name: true, priceArs: true, active: true },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
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

/**
 * Coupon preview for the checkout. When the cart lines are sent, prices are resolved from the
 * catalog so buy X pay Y coupons can be calculated; older clients that only send the eligible
 * subtotal keep working for percentage and fixed amount coupons.
 */
export async function getCouponPreview(payload: unknown) {
  const parsed = couponPreviewSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Cupón inválido.", 400);
  }

  if (!parsed.data.items?.length) {
    return getCouponPreviewForLines({
      code: parsed.data.code,
      taxId: parsed.data.taxId,
      subtotalArs: parsed.data.subtotalArs,
      eligibleLines: null,
    });
  }

  const quantities = new Map<string, number>();

  for (const item of parsed.data.items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }

  const products = (
    await prisma.product.findMany({
      where: { id: { in: Array.from(quantities.keys()) }, active: true, visible: true },
    })
  ).map((product) => applyProductDiscount(product));
  const eligibleLines = getCouponEligibleLines(products).map((product) => ({
    productId: product.id,
    unitPriceArs: product.priceArs,
    quantity: quantities.get(product.id) ?? 0,
  }));
  const subtotalArs = eligibleLines.reduce((total, line) => total + line.unitPriceArs * line.quantity, 0);

  if (subtotalArs <= 0) {
    throw new AppError(COUPON_EXCLUDES_DISCOUNTED_MESSAGE, 400);
  }

  return getCouponPreviewForLines({
    code: parsed.data.code,
    taxId: parsed.data.taxId,
    subtotalArs,
    eligibleLines,
  });
}

/** Server-side coupon pricing over already resolved eligible lines (used by order creation). */
export async function getCouponPreviewForLines(input: {
  code: string;
  taxId?: string | null;
  subtotalArs: number;
  eligibleLines: CouponLine[] | null;
}) {
  const couponCode = normalizeCouponCode(input.code);
  const coupon = await prisma.coupon.findUnique({
    where: { code: couponCode },
  });

  assertCouponIsApplicable(coupon, couponCode);

  if (!coupon) {
    throw new AppError(`El cupón ${couponCode} no existe o no está activo.`, 400);
  }

  if (coupon.discountType === "BUY_X_PAY_Y" && !input.eligibleLines) {
    throw new AppError("Actualizá la página para aplicar este cupón.", 400);
  }

  await assertCouponUsageIsAvailable(coupon, input.taxId);

  return buildCouponSummary(coupon, input.subtotalArs, input.eligibleLines ?? []);
}
