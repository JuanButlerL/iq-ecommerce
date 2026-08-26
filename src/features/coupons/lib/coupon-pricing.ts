import type { Coupon, CouponDiscountType } from "@prisma/client";

import { AppError } from "@/lib/errors/app-error";
import { formatArs } from "@/lib/utils/currency";

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase();
}

export function calculateCouponDiscount(subtotalArs: number, discountPercentage: number) {
  if (subtotalArs <= 0 || discountPercentage <= 0) {
    return 0;
  }

  return Math.round((subtotalArs * discountPercentage) / 100);
}

export function calculateFixedCouponDiscount(subtotalArs: number, fixedDiscountArs: number) {
  if (subtotalArs <= 0 || fixedDiscountArs <= 0) {
    return 0;
  }

  return Math.min(subtotalArs, fixedDiscountArs);
}

export function getCouponDiscountLabel(input: {
  discountType: CouponDiscountType;
  discountPercentage?: number | null;
  fixedDiscountArs?: number | null;
}) {
  if (input.discountType === "FIXED_AMOUNT") {
    return `${formatArs(input.fixedDiscountArs ?? 0)} OFF`;
  }

  return `${input.discountPercentage ?? 0}% OFF`;
}

export function buildCouponSummary(
  coupon: Pick<Coupon, "id" | "code" | "discountType" | "discountPercentage" | "fixedDiscountArs" | "usageType">,
  subtotalArs: number,
) {
  const discountType = coupon.discountType;
  const discountPercentage = coupon.discountPercentage == null ? null : Number(coupon.discountPercentage);
  const fixedDiscountArs = coupon.fixedDiscountArs ?? null;
  const discountArs =
    discountType === "FIXED_AMOUNT"
      ? calculateFixedCouponDiscount(subtotalArs, fixedDiscountArs ?? 0)
      : calculateCouponDiscount(subtotalArs, discountPercentage ?? 0);

  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discountType,
    discountPercentage,
    fixedDiscountArs,
    usageType: coupon.usageType,
    discountArs,
    subtotalWithDiscountArs: Math.max(subtotalArs - discountArs, 0),
  };
}

export function assertCouponIsApplicable<T extends Pick<Coupon, "active">>(coupon: T | null, code: string) {
  if (!coupon || !coupon.active) {
    throw new AppError(`El cupón ${normalizeCouponCode(code)} no existe o no está activo.`, 400);
  }
}
