import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PaymentStatusAutoRefresh } from "@/features/checkout/components/payment-status-auto-refresh";
import {
  getOrderByNumber,
  syncMercadoPagoPaymentByOrderNumber,
} from "@/features/orders/services/order-service";
import { getStoreSettings } from "@/features/settings/queries";
import { getPaymentMethodLabel, getPaymentStatusLabel } from "@/lib/payments/labels";
import { formatArs } from "@/lib/utils/currency";

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orderNumber } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const candidatePaymentId = getFirstSearchParam(
    resolvedSearchParams.payment_id,
    resolvedSearchParams.collection_id,
  );

  if (candidatePaymentId) {
    await syncMercadoPagoPaymentByOrderNumber(orderNumber, candidatePaymentId).catch(() => null);
  }

  const [order, settings] = await Promise.all([getOrderByNumber(orderNumber), getStoreSettings()]);

  if (!order) {
    notFound();
  }

  const isMercadoPago = order.paymentMethod === PaymentMethod.MERCADO_PAGO;
  const isPaid = order.paymentStatus === PaymentStatus.PAID;
  const isRejected = order.paymentStatus === PaymentStatus.REJECTED || order.paymentStatus === PaymentStatus.CANCELLED;

  const eyebrow = isPaid
    ? "Pago confirmado"
    : isMercadoPago
      ? "Seguimiento del pago"
      : "Compra confirmada";

  const title = isPaid
    ? "Tu pago ya fue acreditado"
    : isRejected
      ? "Tu pago necesita atencion"
      : isMercadoPago
        ? "Estamos revisando tu pago"
        : "Gracias por tu compra";

  const message = isPaid
    ? "Ya registramos el pago de forma automatica y tu pedido quedo listo para avanzar a preparacion."
    : isRejected
      ? "Mercado Pago informo que el pago no se pudo acreditar. Puedes reintentar con el mismo pedido o pedir ayuda."
      : isMercadoPago
        ? "Si acabas de pagar, esta pantalla se actualiza al volver. Si sigue pendiente, puedes revisar el estado de nuevo."
        : settings?.purchaseSuccessMessage ??
          "Recibimos tu comprobante. Vamos a validar el pago y seguir con la preparacion del pedido.";

  return (
    <Container className="py-16">
      <Card className="mx-auto max-w-3xl space-y-6 p-8 text-center">
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">{eyebrow}</p>
        <h1 className="font-display text-5xl leading-none text-brand-ink">{title}</h1>
        <p className="text-brand-ink/70">{message}</p>
        <div className="rounded-[2rem] bg-brand-peach p-6">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Pedido</p>
          <p className="mt-2 text-2xl font-extrabold text-brand-ink">{order.publicOrderNumber}</p>
          <p className="mt-4 font-display text-4xl text-brand-pink">{formatArs(order.totalArs)}</p>
          <p className="mt-4 text-sm text-brand-ink/70">
            {isMercadoPago
              ? `Metodo: ${getPaymentMethodLabel(order.paymentMethod)}.`
              : "Tu comprobante ya fue enviado. Si el equipo necesita algo mas, te contacta con estos datos."}
          </p>
        </div>
        <div className="grid gap-3 text-left md:grid-cols-3">
          <div className="rounded-[1.5rem] bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Estado actual</p>
            <p className="mt-2 font-bold text-brand-ink">{getPaymentStatusLabel(order.paymentStatus)}</p>
          </div>
          <div className="rounded-[1.5rem] bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Metodo</p>
            <p className="mt-2 font-bold text-brand-ink">{getPaymentMethodLabel(order.paymentMethod)}</p>
          </div>
          <div className="rounded-[1.5rem] bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Contacto</p>
            <p className="mt-2 font-bold text-brand-ink">{order.customerEmail}</p>
          </div>
        </div>
        {order.paymentStatusDetail ? (
          <div className="rounded-[1.5rem] bg-background px-4 py-3 text-left text-sm text-brand-ink/70">
            <p className="font-bold text-brand-ink">Detalle del pago</p>
            <p className="mt-2">{order.paymentStatusDetail}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap justify-center gap-4">
          {isMercadoPago && !isPaid && order.paymentCheckoutUrl ? (
            <Link href={order.paymentCheckoutUrl} target="_blank">
              <Button>Volver a pagar</Button>
            </Link>
          ) : (
            <Link href="/productos">
              <Button>Seguir comprando</Button>
            </Link>
          )}
          <Link href="/contacto">
            <Button variant="secondary">Necesito ayuda</Button>
          </Link>
        </div>
        <PaymentStatusAutoRefresh
          orderNumber={order.publicOrderNumber}
          paymentMethod={order.paymentMethod}
          initialPaymentStatus={order.paymentStatus}
          paymentId={candidatePaymentId || order.paymentProviderRef}
        />
      </Card>
    </Container>
  );
}

function getFirstSearchParam(...values: Array<string | string[] | undefined>) {
  for (const value of values) {
    if (Array.isArray(value)) {
      if (value[0]) {
        return value[0];
      }

      continue;
    }

    if (value) {
      return value;
    }
  }

  return null;
}
