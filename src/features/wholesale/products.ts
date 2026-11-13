import { revalidatePath } from "next/cache";
import { cache } from "react";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { wholesaleProductOrderSchema, wholesaleProductSchema } from "@/lib/validations/wholesale-product";

export async function getAdminWholesaleProducts() {
  return prisma.wholesaleProduct.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

// Lo que se muestra en /mayoristas: activos y vinculados a un producto de la tienda, en el orden del admin.
// Sin vínculo (por ejemplo, si se borró el producto de la tienda) no se puede vender: el pedido no llegaría a operaciones.
export const getPublicWholesaleProducts = cache(async () => {
  const products = await prisma.wholesaleProduct.findMany({
    where: { active: true, productId: { not: null } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    // Colores e imagen de la tarjeta salen del producto de la tienda vinculado, igual que en la home minorista.
    include: {
      product: {
        select: {
          colorTheme: true,
          visualAccentHex: true,
          visualSurfaceHex: true,
          visualTextHex: true,
          images: { select: { publicUrl: true, altText: true, isPrimary: true }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  return products.map((product) => {
    const image = resolveWholesaleProductImage(product);
    return { ...product, imageUrl: image.url, imageAlt: image.alt };
  });
});

// Fallback por sabor, el mismo que usa la home minorista cuando el producto no tiene fotos.
const RETAIL_FALLBACK_IMAGE = {
  CACAO: "/redesign/product-cacao.png",
  BANANA: "/redesign/product-banana.png",
  PEANUT: "/redesign/product-peanut.png",
} as const;

// La foto que se muestra en /mayoristas es la misma que la tarjeta de la home minorista:
// la principal del producto de la tienda vinculado (o la primera). Solo si la tienda no tiene fotos
// se usa la cargada en el admin mayorista, y como último recurso la del sabor.
export function resolveWholesaleProductImage(product: {
  name: string;
  imageUrl: string;
  imageAlt: string;
  product: { colorTheme: keyof typeof RETAIL_FALLBACK_IMAGE; images: { publicUrl: string; altText: string; isPrimary: boolean }[] } | null;
}) {
  const retailImage = product.product?.images.find((image) => image.isPrimary) ?? product.product?.images[0];

  if (retailImage?.publicUrl) {
    return { url: retailImage.publicUrl, alt: retailImage.altText || product.imageAlt || product.name };
  }

  if (product.imageUrl) {
    return { url: product.imageUrl, alt: product.imageAlt || product.name };
  }

  return {
    url: product.product ? RETAIL_FALLBACK_IMAGE[product.product.colorTheme] ?? "" : "",
    alt: product.imageAlt || product.name,
  };
}

export async function createWholesaleProduct() {
  const last = await prisma.wholesaleProduct.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true, priceArs: true } });

  // Arranca inactivo para que no aparezca en la página hasta completarlo.
  const product = await prisma.wholesaleProduct.create({
    data: {
      name: "Nuevo producto",
      priceArs: last?.priceArs ?? 1,
      active: false,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  revalidateProducts();
  return { id: product.id };
}

export async function updateWholesaleProduct(id: string, payload: unknown) {
  const parsed = wholesaleProductSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Revisá los datos del producto.", 400, true);
  }

  const { count } = await prisma.wholesaleProduct.updateMany({ where: { id: assertId(id) }, data: parsed.data });

  if (count === 0) {
    throw new AppError("El producto no existe o fue eliminado.", 404, true);
  }

  revalidateProducts();
}

export async function deleteWholesaleProduct(id: string) {
  await prisma.wholesaleProduct.deleteMany({ where: { id: assertId(id) } });
  revalidateProducts();
}

export async function reorderWholesaleProducts(payload: unknown) {
  const parsed = wholesaleProductOrderSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Orden inválido.", 400, true);
  }

  await prisma.$transaction(
    parsed.data.ids.map((id, index) => prisma.wholesaleProduct.updateMany({ where: { id }, data: { sortOrder: index } })),
  );

  revalidateProducts();
}

function assertId(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new AppError("El producto no existe.", 404, true);
  }

  return id;
}

function revalidateProducts() {
  revalidatePath("/mayoristas");
  revalidatePath("/admin/mayoristas/productos");
}
