import { notFound } from "next/navigation";

import { ProductForm } from "@/features/admin/components/product-form";
import { getAdminProductById } from "@/features/products/queries";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminEditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const product = await getAdminProductById(id);

  if (!product) {
    notFound();
  }

  return (
    <ProductForm
      mode="edit"
      productId={product.id}
      initialValue={{
        name: product.name,
        slug: product.slug,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        priceArs: product.priceArs,
        colorTheme: product.colorTheme,
        active: product.active,
        visible: product.visible,
        manualSoldOut: product.manualSoldOut,
        featured: product.featured,
        sortOrder: product.sortOrder,
        images: product.images.map((image) => ({
          filePath: image.filePath,
          publicUrl: image.publicUrl,
          altText: image.altText,
          sortOrder: image.sortOrder,
          isPrimary: image.isPrimary,
        })),
      }}
    />
  );
}
