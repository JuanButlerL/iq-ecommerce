import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getMercadoPagoCheckoutCopy,
  getMercadoPagoOrderView,
  refreshMercadoPagoPaymentFromReturn,
} from "@/features/orders/services/mercado-pago-service";
import { formatArs } from "@/lib/utils/currency";

export default async function MercadoPagoReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams?: Promise<{ payment_id?: string; collection_id?: string }>;
}) {
  const { orderNumber } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const paymentId = resolvedSearchParams.payment_id ?? resolvedSearchParams.collection_id;

  if (paymentId) {
    await refreshMercadoPagoPaymentFromReturn(orderNumber, paymentId).catch(() => null);
  }

  const order = await getMercadoPagoOrderView(orderNumber);

  if (!order || order.paymentMethod !== "MERCADO_PAGO") {
    notFound();
  }

  const copy = getReturnCopy(order.paymentProviderStatus ?? undefined, order.paymentProviderStatusDetail ?? undefined);

  return (
    <Container className="py-12 md:py-16">
      <Card className="mx-auto max-w-3xl space-y-6 p-6 text-center md:p-8">
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Mercado Pago</p>
        <h1 className="font-display text-4xl leading-none text-brand-ink md:text-5xl">{copy.title}</h1>
        <p className="mx-auto max-w-xl text-brand-ink/68">{copy.description}</p>

        <div className="rounded-[2rem] bg-brand-peach p-6">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Pedido</p>
          <p className="mt-2 text-2xl font-extrabold text-brand-ink">{order.publicOrderNumber}</p>
          <p className="mt-4 font-display text-4xl text-brand-pink">{formatArs(order.totalArs)}</p>
          <div className="mt-4 grid gap-3 text-left md:grid-cols-3">
            <div className="rounded-[1.4rem] bg-white/70 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Pago</p>
              <p className="mt-2 font-bold text-brand-ink">{getMercadoPagoCheckoutCopy(order)}</p>
            </div>
            <div className="rounded-[1.4rem] bg-white/70 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Estado interno</p>
              <p className="mt-2 font-bold text-brand-ink">{order.paymentStatus}</p>
            </div>
            <div className="rounded-[1.4rem] bg-white/70 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Referencia</p>
              <p className="mt-2 font-bold text-brand-ink">{order.paymentProviderReference ?? "Pendiente"}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {order.paymentStatus === "PAID" ? (
            <Link href={`/checkout/confirmacion/${order.publicOrderNumber}`}>
              <Button>Ver confirmacion</Button>
            </Link>
          ) : order.mercadoPagoPreference ? (
            <Link href={`/checkout/mercado-pago/${order.publicOrderNumber}`}>
              <Button>Intentar de nuevo</Button>
            </Link>
          ) : null}
          <Link href="/contacto">
            <Button variant="secondary">Necesito ayuda</Button>
          </Link>
        </div>
      </Card>
    </Container>
  );
}

function getReturnCopy(status?: string, statusDetail?: string) {
  switch (status) {
    case "approved":
    case "authorized":
      return {
        title: "Pago recibido",
        description: "Tu pedido ya quedo confirmado. Si todavia no ves el cambio, actualizamos el estado en segundos.",
      };
    case "pending":
    case "in_process":
    case "in_mediation":
      return {
        title: "Estamos confirmando tu pago",
        description: "Tu pedido ya existe y seguimos escuchando la confirmacion final de Mercado Pago.",
      };
    case "rejected":
      return {
        title: "No se pudo completar el pago",
        description: "Tu pedido sigue guardado. Si queres, podes intentar de nuevo con Mercado Pago o elegir transferencia.",
      };
    case "cancelled":
      return {
        title: statusDetail === "expired" ? "El pago vencio" : "Pago cancelado",
        description: "Tu pedido sigue guardado. Podes reintentar el pago cuando quieras.",
      };
    default:
      return {
        title: "Tu pedido sigue activo",
        description: "El estado puede tardar unos segundos. Si ya pagaste, el webhook va a actualizarlo aunque cierres esta pagina.",
      };
  }
}
