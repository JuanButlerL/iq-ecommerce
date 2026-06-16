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

function normalizeImages(images: ProductImageInput[]) {
  return images.map((image, index) => ({
    ...image,
    sortOrder: index,
    isPrimary: index === 0,
  }));
}

export async function saveProduct(payload: ProductPayload, productId?: string) {
  const parsed = productFormSchema.safeParse(payload.product);

  if (!parsed.success) {
    throw new AppError("Datos de producto invalidos.", 400);
  }

  const productData = {
    ...parsed.data,
    homeVarietyLabel: parsed.data.homeVarietyLabel || null,
    visualAccentHex: parsed.data.visualAccentHex || null,
    visualSurfaceHex: parsed.data.visualSurfaceHex || null,
    visualTextHex: parsed.data.visualTextHex || null,
  };

  if (payload.images.length === 0) {
    throw new AppError("Debes cargar al menos una imagen.", 400);
  }

  const normalizedImages = normalizeImages(payload.images);

  if (productId) {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: productData,
      });

      await tx.productImage.deleteMany({
        where: { productId },
      });

      await tx.productImage.createMany({
        data: normalizedImages.map((image) => ({
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
        data: productData,
      });

      await tx.productImage.createMany({
        data: normalizedImages.map((image) => ({
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
