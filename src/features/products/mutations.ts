"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { productFormSchema } from "@/lib/validations/product";

type ProductImageInput = {
  filePath: string;
  publicUrl: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
};

type ProductPayload = {
  product: unknown;
  images: ProductImageInput[];
};

export async function saveProduct(payload: ProductPayload, productId?: string) {
  const parsed = productFormSchema.safeParse(payload.product);

  if (!parsed.success) {
    throw new AppError("Datos de producto invalidos.", 400);
  }

  if (payload.images.length === 0) {
    throw new AppError("Debes cargar al menos una imagen.", 400);
  }

  if (productId) {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: parsed.data,
      });

      await tx.productImage.deleteMany({
        where: { productId },
      });

      await tx.productImage.createMany({
        data: payload.images.map((image) => ({
          productId,
          filePath: image.filePath,
          publicUrl: image.publicUrl,
          altText: image.altText,
          sortOrder: image.sortOrder,
          isPrimary: image.isPrimary,
        })),
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: parsed.data,
      });

      await tx.productImage.createMany({
        data: payload.images.map((image) => ({
          productId: product.id,
          filePath: image.filePath,
          publicUrl: image.publicUrl,
          altText: image.altText,
          sortOrder: image.sortOrder,
          isPrimary: image.isPrimary,
        })),
      });
    });
  }

  revalidatePath("/");
  revalidatePath("/productos");
  revalidatePath("/admin/productos");
}

export async function archiveProduct(productId: string) {
  await prisma.product.update({
    where: { id: productId },
    data: {
      active: false,
      visible: false,
    },
  });

  revalidatePath("/");
  revalidatePath("/productos");
  revalidatePath("/admin/productos");
}
