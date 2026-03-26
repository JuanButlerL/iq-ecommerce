import { notFound } from "next/navigation";
import { ArrowRight, Copy } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { CopyValue } from "@/features/checkout/components/copy-value";
import { PaymentProofForm } from "@/features/checkout/components/payment-proof-form";
import { getOrderByNumber } from "@/features/orders/services/order-service";
import { getStoreSettings } from "@/features/settings/queries";
import { formatArs } from "@/lib/utils/currency";
import { buildWhatsappUrl } from "@/lib/utils/whatsapp";

export default async function TransferPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const [order, settings] = await Promise.all([getOrderByNumber(orderNumber), getStoreSettings()]);

  if (!order || !settings) {
    notFound();
  }

  const whatsappUrl = buildWhatsappUrl(
    settings.whatsappNumber,
    `Hola! Ya hice el pedido ${order.publicOrderNumber} y necesito ayuda con la transferencia.`,
  );

  return (
    <Container className="grid gap-8 py-12 md:py-16 lg:grid-cols-[1fr_0.8fr]">
      <Card className="space-y-6 p-6">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Paso 2 de 2</p>
          <h1 className="mt-3 font-display text-3xl leading-none text-brand-ink md:text-5xl">
            Pedido {order.publicOrderNumber}
          </h1>
          <p className="mt-3 text-sm leading-6 text-brand-ink/70 md:text-base">
            Tu pedido ya fue generado, pero todavía falta pagar para confirmarlo.
          </p>
        </div>

        <div className="rounded-[2rem] border-2 border-brand-pink bg-brand-peach p-6 shadow-[0_18px_50px_rgba(244,137,145,0.18)]">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Todavía falta pagar</p>
          <p className="mt-3 text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/60">Monto a transferir</p>
          <p className="mt-2 font-display text-4xl text-brand-pink md:text-6xl">{formatArs(order.totalArs)}</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <CopyValue label="Alias" value={settings.bankAlias} copyable />
            <CopyValue label="CBU" value={settings.bankCbu} copyable />
          </div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-sm font-bold text-brand-ink">
            <Copy className="h-4 w-4 text-brand-pink" />
            Pedido {order.publicOrderNumber}
          </div>

          <p className="mt-4 text-sm text-brand-ink/70">
            1. Pagá con alias o CBU. 2. Volvé a este pedido y subí el comprobante.
          </p>
        </div>

        <details className="rounded-[1.5rem] border border-brand-ink/10 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-bold text-brand-ink">
            Ver datos completos de la cuenta
            <ArrowRight className="h-4 w-4" />
          </summary>
          <div className="grid gap-4 border-t border-brand-ink/10 px-5 py-5 md:grid-cols-2">
            <CopyValue label="Número de pedido" value={order.publicOrderNumber} copyable />
            <CopyValue label="Email" value={settings.contactEmail} />
            <CopyValue label="Banco" value={settings.bankName} />
            <CopyValue label="Titular" value={settings.bankHolder} />
            <CopyValue label="CUIT" value={settings.bankTaxId} />
          </div>
        </details>

        <p className="text-sm text-brand-ink/60">{settings.transferInstructions}</p>
      </Card>

      <PaymentProofForm orderNumber={order.publicOrderNumber} whatsappUrl={whatsappUrl} />
    </Container>
  );
}
