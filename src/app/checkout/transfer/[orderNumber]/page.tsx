import Link from "next/link";
import { MessageCircleMore } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { PaymentProofForm } from "@/features/checkout/components/payment-proof-form";
import { CopyValue } from "@/features/checkout/components/copy-value";
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
    return null;
  }

  const whatsappUrl = buildWhatsappUrl(
    settings.whatsappNumber,
    `Hola! Ya hice el pedido ${order.publicOrderNumber} y necesito ayuda con la transferencia.`,
  );

  return (
    <Container className="grid gap-8 py-12 md:py-16 lg:grid-cols-[1fr_0.8fr]">
      <Card className="space-y-6 p-6">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Transferencia bancaria</p>
          <h1 className="mt-3 font-display text-3xl leading-none text-brand-ink md:text-5xl">Pedido {order.publicOrderNumber}</h1>
          <p className="mt-3 text-sm leading-6 text-brand-ink/70 md:text-base">
            Transferi el monto exacto y subi el comprobante para cerrar el flujo de compra.
          </p>
        </div>
        <div className="rounded-[2rem] bg-brand-peach p-6">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/60">Monto total</p>
          <p className="mt-2 font-display text-3xl text-brand-pink md:text-5xl">{formatArs(order.totalArs)}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <CopyValue label="Alias" value={settings.bankAlias} copyable />
          <CopyValue label="CBU" value={settings.bankCbu} copyable />
          <CopyValue label="Banco" value={settings.bankName} />
          <CopyValue label="Titular" value={settings.bankHolder} />
          <CopyValue label="CUIT" value={settings.bankTaxId} />
          <CopyValue label="Email" value={settings.contactEmail} />
        </div>
        <div className="flex flex-wrap gap-4">
          <Link href={whatsappUrl} target="_blank" className="inline-flex items-center gap-2 rounded-full bg-[#25d366] px-5 py-3 text-sm font-bold text-white">
            <MessageCircleMore className="h-4 w-4" />
            WhatsApp
          </Link>
        </div>
        <div className="rounded-[2rem] border border-brand-ink/10 p-5 text-sm text-brand-ink/70">
          {settings.transferInstructions}
        </div>
      </Card>

      <PaymentProofForm orderNumber={order.publicOrderNumber} />
    </Container>
  );
}
