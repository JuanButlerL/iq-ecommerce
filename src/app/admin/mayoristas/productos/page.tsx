import { WholesaleProductsAdminPanel } from "@/features/admin/components/wholesale-products-admin-panel";
import { getAdminWholesaleProducts } from "@/features/wholesale/products";
import { getWholesaleSettings } from "@/features/wholesale/settings";
import { requireAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";

export default async function AdminWholesaleProductsPage() {
  await requireAdminSection("wholesale");
  const [products, retailProducts, settings] = await Promise.all([
    getAdminWholesaleProducts(),
    prisma.product.findMany({ select: { id: true, name: true, priceArs: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    getWholesaleSettings(),
  ]);

  return (
    <WholesaleProductsAdminPanel
      minDisplays={settings.minDisplays}
      retailProducts={retailProducts}
      products={products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        imageAlt: product.imageAlt,
        priceArs: product.priceArs,
        unitsPerDisplay: product.unitsPerDisplay,
        active: product.active,
        soldOut: product.soldOut,
        kind: product.kind,
        boxDisplays: product.boxDisplays,
        components: product.components.map((component) => ({ productId: component.productId, quantity: component.quantity })),
      }))}
    />
  );
}
