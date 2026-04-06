"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { couponFormSchema } from "@/lib/validations/coupon";
import { normalizeCouponCode } from "@/features/coupons/lib/coupon-pricing";

export async function saveCoupon(payload: unknown, couponId?: string) {
  const parsed = couponFormSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Datos de cupón inválidos.", 400);
  }

  const data = {
    code: normalizeCouponCode(parsed.data.code),
    description: parsed.data.description || null,
    discountPercentage: parsed.data.discountPercentage,
    active: parsed.data.active,
  };

  try {
    if (couponId) {
      await prisma.coupon.update({
        where: { id: couponId },
        data,
      });
    } else {
      await prisma.coupon.create({
        data,
      });
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new AppError("Ya existe un cupón con ese código.", 400);
    }

    throw error;
  }

  revalidateCouponViews();
}

export async function deleteCoupon(couponId: string) {
  await prisma.coupon.delete({
    where: { id: couponId },
  });

  revalidateCouponViews();
}

function revalidateCouponViews() {
  revalidatePath("/checkout");
  revalidatePath("/admin/cupones");
  revalidatePath("/admin/pedidos");
}
