import { revalidatePath } from "next/cache";
import { cache } from "react";

import type { Prisma } from "@prisma/client";

import { WHOLESALE_MAX_BOX_DISPLAYS, displaysPerUnit, isSingleDisplay, type WholesaleSaleProduct } from "@/features/wholesale/bundles";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { wholesaleProductCreateSchema, wholesaleProductOrderSchema, wholesaleProductSchema } from "@/lib/validations/wholesale-product";

const componentsInclude = {
  orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  include: { product: { select: { name: true } } },
} satisfies Prisma.WholesaleProduct$componentsArgs;

export async function getAdminWholesaleProducts() {
  return prisma.wholesaleProduct.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { components: componentsInclude },
  });
}

// Lo que se muestra en /mayoristas: activos y con composición, en el orden del admin.
// Sin composición (por ejemplo, un producto a medio cargar) no se puede vender: el pedido no llegaría a operaciones.
export const getPublicWholesaleProducts = cache(async () => {
  const products = await prisma.wholesaleProduct.findMany({
    where: { active: true, productId: { not: null }, components: { some: {} } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    // Colores e imagen de la tarjeta salen del producto de la tienda vinculado, igual que en la home minorista.
    include: {
      components: componentsInclude,
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
    const kind = product.kind;
    const components = product.components.map((component) => ({
      productId: component.productId,
      name: component.product.name,
      quantity: component.quantity,
    }));
    const image = resolveWholesaleProductImage({ ...product, preferOwnImage: !isSingleDisplay({ kind, components }) });
    return { ...product, components, displays: displaysPerUnit({ kind, boxDisplays: product.boxDisplays, components }), imageUrl: image.url, imageAlt: image.alt };
  });
});

export type PublicWholesaleProduct = Awaited<ReturnType<typeof getPublicWholesaleProducts>>[number];

// Lo que viaja al navegador (página, ficha y carrito).
export function toWholesaleSaleProduct(product: PublicWholesaleProduct): WholesaleSaleProduct {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    priceArs: product.priceArs,
    unitsPerDisplay: product.unitsPerDisplay,
    soldOut: product.soldOut,
    highlighted: product.highlighted,
    kind: product.kind,
    boxDisplays: product.boxDisplays,
    displays: product.displays,
    components: product.components,
  };
}

// Fallback por sabor, el mismo que usa la home minorista cuando el producto no tiene fotos.
const RETAIL_FALLBACK_IMAGE = {
  CACAO: "/redesign/product-cacao.png",
  BANANA: "/redesign/product-banana.png",
  PEANUT: "/redesign/product-peanut.png",
} as const;

// La foto de un display suelto es la misma que la tarjeta de la home minorista: la principal del producto
// de la tienda vinculado (o la primera). Solo si la tienda no tiene fotos se usa la cargada en el admin mayorista,
// y como último recurso la del sabor. Un bulto o una caja a elección usan primero su propia foto del admin.
export function resolveWholesaleProductImage(product: {
  name: string;
  imageUrl: string;
  imageAlt: string;
  preferOwnImage?: boolean;
  product: { colorTheme: keyof typeof RETAIL_FALLBACK_IMAGE; images: { publicUrl: string; altText: string; isPrimary: boolean }[] } | null;
}) {
  if (product.preferOwnImage && product.imageUrl) {
    return { url: product.imageUrl, alt: product.imageAlt || product.name };
  }

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

export async function createWholesaleProduct(payload: unknown) {
  const { kind } = wholesaleProductCreateSchema.parse(payload ?? {});
  const [last, settings] = await Promise.all([
    prisma.wholesaleProduct.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } }),
    prisma.wholesaleSettings.findUnique({ where: { id: "default" }, select: { minDisplays: true } }),
  ]);

  // Arranca oculto para que no aparezca en la página hasta completarlo.
  const product = await prisma.wholesaleProduct.create({
    data: {
      name: kind === "CUSTOM" ? "Armá tu caja" : "Nuevo bulto",
      kind,
      // La caja a elección arranca del tamaño del pedido mínimo (hoy, una caja de 10 displays).
      boxDisplays: Math.min(Math.max(settings?.minDisplays ?? 10, 1), WHOLESALE_MAX_BOX_DISPLAYS),
      priceArs: 1,
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

  const { components, ...data } = parsed.data;
  const productId = assertId(id);
  const retailIds = components.map((component) => component.productId);
  const existingRetail = retailIds.length > 0 ? await prisma.product.count({ where: { id: { in: retailIds } } }) : 0;

  if (existingRetail !== retailIds.length) {
    throw new AppError("Uno de los productos de la tienda elegidos ya no existe. Recargá la página.", 400, true);
  }

  await prisma.$transaction(async (tx) => {
    // El primero de la composición da la foto y los colores de la tarjeta.
    const { count } = await tx.wholesaleProduct.updateMany({ where: { id: productId }, data: { ...data, productId: retailIds[0] ?? null } });

    if (count === 0) {
      throw new AppError("El producto no existe o fue eliminado.", 404, true);
    }

    // "Más elegido" lo lleva uno solo: marcarlo en este lo saca de los demás.
    if (data.highlighted) {
      await tx.wholesaleProduct.updateMany({ where: { id: { not: productId }, highlighted: true }, data: { highlighted: false } });
    }

    await tx.wholesaleProductComponent.deleteMany({ where: { wholesaleProductId: productId } });
    if (components.length > 0) {
      await tx.wholesaleProductComponent.createMany({
        data: components.map((component, index) => ({ wholesaleProductId: productId, productId: component.productId, quantity: component.quantity, sortOrder: index })),
      });
    }
  });

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
