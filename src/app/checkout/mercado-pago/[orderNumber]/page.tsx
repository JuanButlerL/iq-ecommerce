import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { MercadoPagoRedirectCard } from "@/features/checkout/components/mercado-pago-redirect-card";
import { getMercadoPagoCheckoutCopy, getMercadoPagoOrderView } from "@/features/orders/services/mercado-pago-service";
import { preferMercadoPagoSandboxUrl } from "@/lib/integrations/mercadopago/client";
import { formatArs } from "@/lib/utils/currency";

export default async function MercadoPagoStartPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = await getMercadoPagoOrderView(orderNumber);

  if (!order || order.paymentMethod !== "MERCADO_PAGO") {
    notFound();
  }

  const initPoint = preferMercadoPagoSandboxUrl()
    ? order.mercadoPagoPreference?.sandboxInitPoint ?? order.mercadoPagoPreference?.initPoint
    : order.mercadoPagoPreference?.initPoint;

  return (
    <Container className="py-12 md:py-16">
      <Card className="mx-auto max-w-2xl space-y-6 p-6 text-center md:p-8">
        <h1 className="font-display text-4xl leading-none text-brand-ink md:text-5xl">Seguimos en Mercado Pago</h1>

        <div className="rounded-[2rem] bg-brand-peach p-6">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Pedido</p>
          <p className="mt-2 text-2xl font-extrabold text-brand-ink">{order.publicOrderNumber}</p>
          <p className="mt-4 font-display text-4xl text-brand-pink">{formatArs(order.totalArs)}</p>
          <p className="mt-3 text-sm text-brand-ink/65">{getMercadoPagoCheckoutCopy(order)}</p>
        </div>

        {initPoint ? <MercadoPagoRedirectCard initPoint={initPoint} /> : null}
        <p className="text-sm text-brand-ink/52">Mercado Pago te va a devolver a IQ Kids al finalizar.</p>
      </Card>
    </Container>
  );
}
