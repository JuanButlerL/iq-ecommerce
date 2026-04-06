import { cache } from "react";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { couponPreviewSchema } from "@/lib/validations/coupon";
import { assertCouponIsApplicable, buildCouponSummary, normalizeCouponCode } from "@/features/coupons/lib/coupon-pricing";

export const getCoupons = cache(async () => {
  return prisma.coupon.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });
});

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

  return buildCouponSummary(coupon, parsed.data.subtotalArs);
}
