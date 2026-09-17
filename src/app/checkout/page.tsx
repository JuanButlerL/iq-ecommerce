import { Container } from "@/components/layout/container";
import { CheckoutPage } from "@/features/checkout/components/checkout-page";
import { getVisibleProducts } from "@/features/catalog/queries";
import { getStoreSettingsForClient } from "@/features/settings/queries";
import { env } from "@/lib/env";
import { notFound } from "next/navigation";

type CheckoutRoutePageProps = {
  searchParams?: Promise<{
    province?: string | string[];
    email?: string | string[];
    recoveryBenefit?: string | string[];
  }>;
};

export default async function CheckoutRoutePage({ searchParams }: CheckoutRoutePageProps) {
  const params = await searchParams;
  const requestedProvince = Array.isArray(params?.province) ? params.province[0] : params?.province;
  const requestedEmail = Array.isArray(params?.email) ? params.email[0] : params?.email;
  const requestedRecoveryBenefit = Array.isArray(params?.recoveryBenefit) ? params.recoveryBenefit[0] : params?.recoveryBenefit;
  const [products, settings] = await Promise.all([getVisibleProducts(), getStoreSettingsForClient()]);

  if (!settings) {
    notFound();
  }

  return (
    <Container className="py-12 md:py-16">
      <CheckoutPage
        products={products}
        settings={settings}
        mercadoPagoEnabled={env.mercadoPagoEnabled && env.hasMercadoPagoAccessToken}
        initialProvince={requestedProvince}
        initialEmail={requestedEmail}
        initialCartRecoveryFreeShippingToken={requestedRecoveryBenefit}
      />
    </Container>
  );
}
