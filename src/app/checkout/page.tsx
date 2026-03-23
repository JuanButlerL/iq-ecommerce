import { Container } from "@/components/layout/container";
import { CheckoutPage } from "@/features/checkout/components/checkout-page";
import { getVisibleProducts } from "@/features/catalog/queries";
import { getStoreSettings } from "@/features/settings/queries";

export default async function CheckoutRoutePage() {
  const [products, settings] = await Promise.all([getVisibleProducts(), getStoreSettings()]);

  if (!settings) {
    return null;
  }

  return (
    <Container className="py-12 md:py-16">
      <CheckoutPage products={products} settings={settings} />
    </Container>
  );
}
