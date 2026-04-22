import { Container } from "@/components/layout/container";
import { CheckoutPage } from "@/features/checkout/components/checkout-page";
import { getVisibleProducts } from "@/features/catalog/queries";
import { getStoreSettings } from "@/features/settings/queries";
import { canUseMercadoPagoCheckout } from "@/lib/integrations/mercadopago/client";
import { notFound } from "next/navigation";

export default async function CheckoutRoutePage() {
  const [products, settings] = await Promise.all([getVisibleProducts(), getStoreSettings()]);

  if (!settings) {
    notFound();
  }

  return (
    <Container className="py-12 md:py-16">
      <CheckoutPage products={products} settings={settings} mercadoPagoEnabled={canUseMercadoPagoCheckout()} />
    </Container>
  );
}
