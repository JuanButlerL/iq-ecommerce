"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { parseArgentinaDateParam } from "@/lib/utils/datetime";
import { productDiscountFormSchema } from "@/lib/validations/product-discount";

export async function saveProductDiscount(productId: string, payload: unknown) {
  const parsed = productDiscountFormSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Datos de descuento inválidos.", 400, true);
  }

  const { discountType, discountPercentage, buyQuantity, payQuantity, freeUnitsCountForFreeShipping, startsOn, endsOn } =
    parsed.data;
  // Dates are whole Argentina days: "desde" starts at 00:00, "hasta" includes the full day.
  const dates = {
    discountStartsAt: parseArgentinaDateParam(startsOn || null) ?? null,
    discountEndsAt: parseArgentinaDateParam(endsOn || null, true) ?? null,
  };
  const noDiscount = {
    discountType: "PERCENTAGE" as const,
    discountPercentage: null,
    discountBuyQuantity: null,
    discountPayQuantity: null,
    discountFreeUnitsCountForFreeShipping: true,
    discountStartsAt: null,
    discountEndsAt: null,
  };
  // A product has a single promo at a time: saving one type always clears the other.
  const data =
    discountType === "BUY_X_PAY_Y" && buyQuantity != null && payQuantity != null
      ? {
          ...noDiscount,
          discountType: "BUY_X_PAY_Y" as const,
          discountBuyQuantity: buyQuantity,
          discountPayQuantity: payQuantity,
          discountFreeUnitsCountForFreeShipping: freeUnitsCountForFreeShipping,
          ...dates,
        }
      : discountType === "PERCENTAGE" && discountPercentage
        ? { ...noDiscount, discountPercentage, ...dates }
        : noDiscount;

  const { count } = await prisma.product.updateMany({
    where: { id: assertProductId(productId) },
    data,
  });

  if (count === 0) {
    throw new AppError("El producto no existe.", 404, true);
  }

  revalidatePath("/", "layout");
}

function assertProductId(productId: string) {
  if (!z.string().uuid().safeParse(productId).success) {
    throw new AppError("El producto no existe.", 404, true);
  }

  return productId;
}
