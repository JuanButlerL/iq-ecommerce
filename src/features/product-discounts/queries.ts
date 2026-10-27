import { calculateDiscountedPrice, getProductDiscountStatus } from "@/features/catalog/lib/product-discount";
import { prisma } from "@/lib/db/prisma";
import { getArgentinaDateKey } from "@/lib/utils/datetime";

export async function getAdminProductDiscounts() {
  const products = await prisma.product.findMany({
    include: {
      images: {
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        take: 1,
      },
    },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const now = new Date();

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    active: product.active,
    visible: product.visible,
    imageUrl: product.images[0]?.publicUrl ?? null,
    priceArs: product.priceArs,
    discountPercentage: product.discountPercentage,
    discountedPriceArs: product.discountPercentage
      ? calculateDiscountedPrice(product.priceArs, product.discountPercentage)
      : null,
    startsOn: product.discountStartsAt ? getArgentinaDateKey(product.discountStartsAt) : "",
    endsOn: product.discountEndsAt ? getArgentinaDateKey(product.discountEndsAt) : "",
    status: getProductDiscountStatus(product, now),
  }));
}

export type AdminProductDiscount = Awaited<ReturnType<typeof getAdminProductDiscounts>>[number];
