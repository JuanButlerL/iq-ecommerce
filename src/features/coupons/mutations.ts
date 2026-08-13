"use server";

import { revalidatePath } from "next/cache";

import { normalizeCouponCode } from "@/features/coupons/lib/coupon-pricing";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { couponFormSchema } from "@/lib/validations/coupon";

function uniqueCodes(codes: string[]) {
  return Array.from(new Set(codes.map(normalizeCouponCode).filter(Boolean)));
}

function buildDiscountPayload(input: {
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountPercentage?: number | null;
  fixedDiscountArs?: number | null;
}) {
  if (input.discountType === "PERCENTAGE") {
    return {
      discountType: input.discountType,
      discountPercentage: input.discountPercentage ?? undefined,
      fixedDiscountArs: null,
    } as const;
  }

  return {
    discountType: input.discountType,
    discountPercentage: 0,
    fixedDiscountArs: input.fixedDiscountArs ?? undefined,
  } as const;
}

export async function saveCoupon(payload: unknown, couponId?: string) {
  const parsed = couponFormSchema.safeParse(payload);

  if (!parsed.success) {
    const issueMessage = parsed.error.issues[0]?.message ?? "Datos de cupon invalidos.";
    throw new AppError(issueMessage, 400);
  }

  const entries = parsed.data.entries?.length
    ? parsed.data.entries.map((entry) => ({
        code: normalizeCouponCode(entry.code),
        discountPercentage: entry.discountPercentage ?? null,
        fixedDiscountArs: entry.fixedDiscountArs ?? null,
      }))
    : [];
  const codes = uniqueCodes(parsed.data.codes?.length ? parsed.data.codes : parsed.data.code ? [parsed.data.code] : []);

  if (!entries.length && !codes.length) {
    throw new AppError("Ingresa al menos un codigo.", 400);
  }

  if (couponId && (entries.length > 1 || codes.length > 1)) {
    throw new AppError("La edicion permite modificar un cupon por vez.", 400);
  }

  const baseData = {
    description: parsed.data.description || null,
    usageType: parsed.data.usageType,
    active: parsed.data.active,
  };

  const requestedCodes = entries.length ? entries.map((entry) => entry.code) : codes;

  if (requestedCodes.length > 0) {
    const existingCoupons = await prisma.coupon.findMany({
      where: {
        code: { in: requestedCodes },
        ...(couponId ? { id: { not: couponId } } : {}),
      },
      select: { code: true },
    });

    if (existingCoupons.length > 0) {
      const duplicatedCodes = existingCoupons.map((coupon) => coupon.code).sort();
      throw new AppError(
        `Ya existen cupones con estos codigos: ${duplicatedCodes.join(", ")}.`,
        400,
      );
    }
  }

  try {
    if (couponId) {
      const singleEntry = entries[0] ?? null;
      const code = singleEntry?.code ?? codes[0];

      await prisma.coupon.update({
        where: { id: couponId },
        data: {
          ...baseData,
          code,
          ...buildDiscountPayload({
            discountType: parsed.data.discountType,
            discountPercentage: singleEntry?.discountPercentage ?? parsed.data.discountPercentage,
            fixedDiscountArs: singleEntry?.fixedDiscountArs ?? parsed.data.fixedDiscountArs,
          }),
        },
      });

      revalidateCouponViews();
      return { created: 0, updated: 1 };
    }

    const createData = entries.length
      ? entries.map((entry) => ({
          ...baseData,
          code: entry.code,
          ...buildDiscountPayload({
            discountType: parsed.data.discountType,
            discountPercentage: entry.discountPercentage ?? parsed.data.discountPercentage,
            fixedDiscountArs: entry.fixedDiscountArs ?? parsed.data.fixedDiscountArs,
          }),
        }))
      : codes.map((code) => ({
          ...baseData,
          code,
          ...buildDiscountPayload({
            discountType: parsed.data.discountType,
            discountPercentage: parsed.data.discountPercentage,
            fixedDiscountArs: parsed.data.fixedDiscountArs,
          }),
        }));

    await prisma.coupon.createMany({
      data: createData,
      skipDuplicates: false,
    });

    revalidateCouponViews();
    return { created: createData.length, updated: 0 };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new AppError("Ya existe un cupon con alguno de esos codigos.", 400);
    }

    throw error;
  }
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
  revalidatePath("/admin/emails");
}
