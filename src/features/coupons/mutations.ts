"use server";

import { revalidatePath } from "next/cache";

import { normalizeCouponCode } from "@/features/coupons/lib/coupon-pricing";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { couponFormSchema } from "@/lib/validations/coupon";

function uniqueCodes(codes: string[]) {
  return Array.from(new Set(codes.map(normalizeCouponCode).filter(Boolean)));
}

export async function saveCoupon(payload: unknown, couponId?: string) {
  const parsed = couponFormSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Datos de cupón inválidos.", 400);
  }

  const codes = uniqueCodes(parsed.data.codes?.length ? parsed.data.codes : parsed.data.code ? [parsed.data.code] : []);

  if (!codes.length) {
    throw new AppError("Ingresá al menos un código.", 400);
  }

  if (couponId && codes.length > 1) {
    throw new AppError("La edición permite modificar un cupón por vez.", 400);
  }

  const baseData = {
    description: parsed.data.description || null,
    discountPercentage: parsed.data.discountPercentage,
    usageType: parsed.data.usageType,
    active: parsed.data.active,
  };

  try {
    if (couponId) {
      await prisma.coupon.update({
        where: { id: couponId },
        data: {
          ...baseData,
          code: codes[0],
        },
      });
      revalidateCouponViews();

      return { created: 0, updated: 1 };
    }

    await prisma.coupon.createMany({
      data: codes.map((code) => ({
        ...baseData,
        code,
      })),
      skipDuplicates: false,
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new AppError("Ya existe un cupón con alguno de esos códigos.", 400);
    }

    throw error;
  }

  revalidateCouponViews();

  return { created: codes.length, updated: 0 };
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
