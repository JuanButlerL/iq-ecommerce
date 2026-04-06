import type { Coupon } from "@prisma/client";

import { AppError } from "@/lib/errors/app-error";

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase();
}

export function calculateCouponDiscount(subtotalArs: number, discountPercentage: number) {
  if (subtotalArs <= 0 || discountPercentage <= 0) {
    return 0;
  }

  return Math.round((subtotalArs * discountPercentage) / 100);
}

export function buildCouponSummary(coupon: Pick<Coupon, "id" | "code" | "discountPercentage">, subtotalArs: number) {
  const discountPercentage = Number(coupon.discountPercentage);
  const discountArs = calculateCouponDiscount(subtotalArs, discountPercentage);

  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discountPercentage,
    discountArs,
    subtotalWithDiscountArs: Math.max(subtotalArs - discountArs, 0),
  };
}

export function assertCouponIsApplicable<T extends Pick<Coupon, "active">>(coupon: T | null, code: string) {
  if (!coupon || !coupon.active) {
    throw new AppError(`El cupón ${normalizeCouponCode(code)} no existe o no está activo.`, 400);
  }
}
