import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

const productInclude = {
  images: {
    orderBy: {
      sortOrder: "asc" as const,
    },
  },
};

export const getFeaturedProducts = cache(async () => {
  return prisma.product.findMany({
    where: {
      active: true,
      visible: true,
    },
    include: productInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: 3,
  });
});

export const getVisibleProducts = cache(async () => {
  return prisma.product.findMany({
    where: {
      active: true,
      visible: true,
    },
    include: productInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
});

export const getProductBySlug = cache(async (slug: string) => {
  return prisma.product.findUnique({
    where: { slug },
    include: productInclude,
  });
});

export async function getSimilarProducts(productId: string) {
  return prisma.product.findMany({
    where: {
      id: { not: productId },
      active: true,
      visible: true,
    },
    include: productInclude,
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }],
    take: 3,
  });
}
