import { cache } from "react";

import { applyProductDiscount } from "@/features/catalog/lib/product-discount";
import { prisma } from "@/lib/db/prisma";

const productInclude = {
  images: {
    orderBy: {
      sortOrder: "asc" as const,
    },
  },
};

export const getFeaturedProducts = cache(async () => {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      visible: true,
    },
    include: productInclude,
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return products.map((product) => applyProductDiscount(product));
});

export const getVisibleProducts = cache(async () => {
  const products = await prisma.product.findMany({
    where: {
      active: true,
      visible: true,
    },
    include: productInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return products.map((product) => applyProductDiscount(product));
});

export const getProductBySlug = cache(async (slug: string) => {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: productInclude,
  });

  return product ? applyProductDiscount(product) : null;
});

export async function getSimilarProducts(productId: string) {
  const products = await prisma.product.findMany({
    where: {
      id: { not: productId },
      active: true,
      visible: true,
    },
    include: productInclude,
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
    take: 3,
  });

  return products.map((product) => applyProductDiscount(product));
}
