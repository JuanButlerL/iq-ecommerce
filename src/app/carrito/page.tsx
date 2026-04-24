import { Container } from "@/components/layout/container";
import { CartPage } from "@/features/cart/components/cart-page";
import { getVisibleProducts } from "@/features/catalog/queries";
import { getStoreSettingsForClient } from "@/features/settings/queries";
import { notFound } from "next/navigation";

export default async function CartRoutePage() {
  const [products, settings] = await Promise.all([getVisibleProducts(), getStoreSettingsForClient()]);

  if (!settings) {
    notFound();
  }

  return (
    <Container className="py-12 md:py-16">
      <CartPage products={products} settings={settings} />
    </Container>
  );
}
