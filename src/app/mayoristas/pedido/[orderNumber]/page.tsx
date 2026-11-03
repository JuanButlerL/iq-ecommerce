import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PaymentProofForm } from "@/features/checkout/components/payment-proof-form";
import { getOrderByNumber } from "@/features/orders/services/order-service";
import { getStoreSettings } from "@/features/settings/queries";
import { WHOLESALE_PAYMENT_METHOD_LABELS, type WholesalePaymentMethod } from "@/features/wholesale/pricing";
import { getWholesaleSettings } from "@/features/wholesale/settings";
import { formatArs } from "@/lib/utils/currency";

export const metadata: Metadata = {
  title: "Tu pedido mayorista",
  robots: { index: false, follow: false },
};

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-[2rem] bg-white p-5 shadow-card sm:p-7">
      {title ? <h2 className="mb-4 font-display text-2xl leading-none text-brand-ink">{title}</h2> : null}
      {children}
    </section>
  );
}

export default async function WholesaleOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const [order, storeSettings, wholesaleSettings] = await Promise.all([getOrderByNumber(orderNumber), getStoreSettings(), getWholesaleSettings()]);

  if (!order || order.channel !== "WHOLESALE") {
    notFound();
  }

  const paymentMethod = order.paymentMethod as WholesalePaymentMethod;
  const paid = order.paymentStatus === "PAID";
  const proofUploaded = order.paymentStatus === "PROOF_UPLOADED";
  const cancelled = order.orderStatus === "CANCELLED" || order.orderStatus === "EXPIRED";
  const needsProof = (paymentMethod === "BANK_TRANSFER" || paymentMethod === "ECHEQ") && order.paymentStatus === "PENDING" && !cancelled;
  const mercadoPagoPending = paymentMethod === "MERCADO_PAGO" && !paid && !cancelled;
  const orderUrl = `/mayoristas/pedido/${order.publicOrderNumber}`;

  const totals: [string, string][] = [
    ["Subtotal", formatArs(order.subtotalArs)],
    ...(order.extraDiscountArs > 0
      ? ([[`Descuento especial${order.extraDiscountPercentage ? ` (${Number(order.extraDiscountPercentage)}%)` : ""}`, `−${formatArs(order.extraDiscountArs)}`]] as [string, string][])
      : []),
    ...(order.paymentMethodDiscountArs > 0 ? ([["Descuento por transferencia", `−${formatArs(order.paymentMethodDiscountArs)}`]] as [string, string][]) : []),
    ["Envío", order.shippingArs > 0 ? formatArs(order.shippingArs) : "Sin cargo"],
  ];

  const status = cancelled
    ? "Pedido cancelado"
    : paid
      ? "Pago acreditado: estamos preparando tu pedido"
      : proofUploaded
        ? "Recibimos tu comprobante: lo revisamos y despachamos"
        : paymentMethod === "DEFERRED"
          ? "Pedido confirmado: lo pagás después de la entrega"
          : "Pedido recibido: falta el pago";

  return (
    <div className="bg-[#fff6f7] px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto flex max-w-[720px] flex-col gap-6">
        <div className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-brand-pink">iQ Kids Mayoristas</p>
          <h1 className="mt-3 font-display text-4xl leading-none text-brand-ink md:text-5xl">¡Gracias, {order.customerFirstName}!</h1>
          <p className="mt-3 text-base text-brand-ink/70">
            Pedido <strong className="text-brand-ink">{order.publicOrderNumber}</strong> · {status}
          </p>
          <p className="mt-1 text-sm text-brand-ink/55">Te mandamos el detalle a {order.customerEmail}.</p>
        </div>

        {needsProof && paymentMethod === "BANK_TRANSFER" ? (
          <Card title="Datos para transferir">
            <p className="mb-4 text-sm leading-6 text-brand-ink/70">Transferí el total y subí el comprobante. Despachamos cuando se acredita.</p>
            <PaymentProofForm
              orderNumber={order.publicOrderNumber}
              amount={formatArs(order.totalArs)}
              alias={storeSettings?.bankAlias}
              extraRows={[
                ...(storeSettings?.bankCbu ? [{ label: "CBU", value: storeSettings.bankCbu }] : []),
                ...(storeSettings?.bankHolder ? [{ label: "Titular", value: storeSettings.bankHolder }] : []),
                ...(storeSettings?.bankTaxId ? [{ label: "CUIT", value: storeSettings.bankTaxId }] : []),
              ]}
              successHref={orderUrl}
              clearRetailCart={false}
            />
          </Card>
        ) : null}

        {needsProof && paymentMethod === "ECHEQ" ? (
          <Card title="Datos para el eCheq">
            <p className="mb-4 whitespace-pre-line text-sm leading-6 text-brand-ink/70">
              {wholesaleSettings.echeqInstructions ||
                `Emití el eCheq por el total, con fecha de pago a ${wholesaleSettings.echeqMaxDays} días como máximo, y subí el comprobante. Despachamos cuando lo recibimos.`}
            </p>
            <PaymentProofForm
              orderNumber={order.publicOrderNumber}
              amount={formatArs(order.totalArs)}
              extraRows={[
                ...(storeSettings?.bankHolder ? [{ label: "A nombre de", value: storeSettings.bankHolder }] : []),
                ...(storeSettings?.bankTaxId ? [{ label: "CUIT", value: storeSettings.bankTaxId }] : []),
                { label: "Plazo máximo", value: `${wholesaleSettings.echeqMaxDays} días` },
              ]}
              successHref={orderUrl}
              clearRetailCart={false}
            />
          </Card>
        ) : null}

        {mercadoPagoPending ? (
          <Card>
            <p className="text-sm leading-6 text-brand-ink/70">Todavía no vemos el pago acreditado en Mercado Pago. Si no lo terminaste, podés retomarlo.</p>
            <Link
              href={`/checkout/mercado-pago/${order.publicOrderNumber}`}
              className="mt-4 inline-flex h-12 items-center justify-center rounded-full bg-brand-pink px-6 text-sm font-extrabold text-white shadow-soft transition hover:bg-[#ea737d]"
            >
              Pagar con Mercado Pago
            </Link>
          </Card>
        ) : null}

        {paymentMethod === "DEFERRED" && !cancelled ? (
          <Card>
            <p className="text-sm leading-6 text-brand-ink/70">
              El pago es posterior a la entrega, según las condiciones acordadas con tu cuenta. Te escribimos para coordinar el envío.
            </p>
          </Card>
        ) : null}

        <Card title="Detalle">
          <ul className="divide-y divide-brand-ink/10 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 py-2.5 tabular-nums">
                <span className="text-brand-ink">
                  {item.productNameSnapshot} × {item.quantity}
                </span>
                <span className="shrink-0 font-bold text-brand-ink">{formatArs(item.lineTotalArs)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-2 border-t-2 border-brand-ink/10 pt-3 text-sm tabular-nums">
            {totals.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-brand-ink/65">{label}</dt>
                <dd className="font-bold text-brand-ink">{value}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 pt-1">
              <dt className="font-extrabold text-brand-ink">Total</dt>
              <dd className="font-display text-3xl text-brand-ink">{formatArs(order.totalArs)}</dd>
            </div>
          </dl>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-brand-ink/45">Pago</dt>
              <dd className="mt-1 text-brand-ink">{WHOLESALE_PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.12em] text-brand-ink/45">Entrega</dt>
              <dd className="mt-1 text-brand-ink">
                {order.locality}, {order.province}
              </dd>
            </div>
          </dl>
        </Card>

        <p className="text-center text-sm text-brand-ink/60">
          ¿Querés volver a pedir?{" "}
          <Link href="/mayoristas#productos" className="font-bold text-brand-pink hover:underline">
            Ir a la tienda mayorista
          </Link>
        </p>
      </div>
    </div>
  );
}
