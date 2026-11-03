"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { homeFeaturedProductsSchema } from "@/lib/validations/home-featured-product";

export async function saveHomeFeaturedProductSlots(payload: unknown) {
  const parsed = homeFeaturedProductsSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Datos de productos destacados invalidos.", 400, true);
  }

  const { slots } = parsed.data;
  const uniqueProductIds = new Set(slots.map((slot) => slot.productId));

  if (uniqueProductIds.size !== slots.length) {
    throw new AppError("Cada producto puede aparecer una sola vez en el home.", 400, true);
  }

  const existingCount = await prisma.product.count({
    where: {
      id: { in: Array.from(uniqueProductIds) },
    },
  });

  if (existingCount !== uniqueProductIds.size) {
    throw new AppError("Uno o mas productos seleccionados ya no existen.", 400, true);
  }

  // The list is saved as a whole: replacing it keeps slot orders consecutive (1..n)
  // without clashing with the unique slot_order index while reordering.
  await prisma.$transaction([
    prisma.homeFeaturedProductSlot.deleteMany({}),
    prisma.homeFeaturedProductSlot.createMany({
      data: slots.map((slot, index) => ({
        slotOrder: index + 1,
        productId: slot.productId,
        eyebrow: slot.eyebrow,
        title: slot.title,
        description: slot.description,
        quote: slot.quote || null,
        buttonLabel: slot.buttonLabel,
      })),
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/admin/home-productos");
}
