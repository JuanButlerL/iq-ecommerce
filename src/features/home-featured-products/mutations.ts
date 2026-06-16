"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { homeFeaturedProductsSchema } from "@/lib/validations/home-featured-product";

export async function saveHomeFeaturedProductSlots(payload: unknown) {
  const parsed = homeFeaturedProductsSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Datos de productos destacados invalidos.", 400);
  }

  const uniqueSlotOrders = new Set(parsed.data.slots.map((slot) => slot.slotOrder));
  const uniqueProductIds = new Set(parsed.data.slots.map((slot) => slot.productId));

  if (uniqueSlotOrders.size !== 4) {
    throw new AppError("Cada posicion del home debe aparecer una sola vez.", 400);
  }

  if (uniqueProductIds.size !== 4) {
    throw new AppError("Cada posicion del home debe usar un producto distinto.", 400);
  }

  const products = await prisma.product.findMany({
    where: {
      id: { in: Array.from(uniqueProductIds) },
    },
    select: {
      id: true,
    },
  });

  if (products.length !== 4) {
    throw new AppError("Uno o mas productos seleccionados ya no existen.", 400);
  }

  await prisma.$transaction(
    parsed.data.slots.map((slot) =>
      prisma.homeFeaturedProductSlot.upsert({
        where: { slotOrder: slot.slotOrder },
        update: {
          productId: slot.productId,
          eyebrow: slot.eyebrow,
          title: slot.title,
          description: slot.description,
          quote: slot.quote || null,
          buttonLabel: slot.buttonLabel,
        },
        create: {
          slotOrder: slot.slotOrder,
          productId: slot.productId,
          eyebrow: slot.eyebrow,
          title: slot.title,
          description: slot.description,
          quote: slot.quote || null,
          buttonLabel: slot.buttonLabel,
        },
      }),
    ),
  );

  revalidatePath("/");
  revalidatePath("/admin/home-productos");
}
