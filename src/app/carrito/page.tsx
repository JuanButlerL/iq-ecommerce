import { Container } from "@/components/layout/container";
import { CartPage } from "@/features/cart/components/cart-page";
import { parsePresetCart } from "@/features/cart/lib/preset-cart";
import { getVisibleProducts } from "@/features/catalog/queries";
import { getStoreSettingsForClient } from "@/features/settings/queries";
import { notFound } from "next/navigation";

export default async function CartRoutePage({
  searchParams,
}: {
  searchParams?: Promise<{ recuperar?: string; productos?: string }>;
}) {
  const params = await searchParams;
  const [products, settings] = await Promise.all([getVisibleProducts(), getStoreSettingsForClient()]);

  if (!settings) {
    notFound();
  }

  return (
    <Container className="py-12 md:py-16">
      <CartPage
        products={products}
        settings={settings}
        recoveryToken={params?.recuperar}
        presetItems={params?.recuperar ? [] : parsePresetCart(params?.productos, products)}
      />
    </Container>
  );
}
