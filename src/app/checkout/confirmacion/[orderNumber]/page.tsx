import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MetaPixelPurchase } from "@/components/analytics/meta-pixel-purchase";
import { TrackEventOnView } from "@/components/analytics/track-event-on-view";
import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { getOrderByNumber } from "@/features/orders/services/order-service";
import { OrderShippingStatus } from "@/features/logistics/components/order-shipping-status";
import { getStoreSettings } from "@/features/settings/queries";
import { formatArs } from "@/lib/utils/currency";
import { getProductsValue } from "@/lib/meta-commerce";

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const [order, settings] = await Promise.all([getOrderByNumber(orderNumber), getStoreSettings()]);

  if (!order) {
    notFound();
  }

  // Mercado Pago vuelve acá para todos los pedidos; los mayoristas tienen su propia página.
  if (order.channel === "WHOLESALE") {
    redirect(`/mayoristas/pedido/${order.publicOrderNumber}`);
  }

  const isMercadoPago = order.paymentMethod === "MERCADO_PAGO";
  const shouldTrackAnalyticsPurchase = order.paymentStatus === "PAID" || order.paymentStatus === "PROOF_UPLOADED";
  const shouldTrackMetaPurchase = shouldTrackAnalyticsPurchase || order.paymentMethod === "BANK_TRANSFER";
  const productsValue = getProductsValue(order.totalArs, order.shippingArs);
  const purchaseItems = order.items.map((item) => ({
    id: item.productId ?? item.id,
    name: item.productNameSnapshot,
    quantity: item.quantity,
    itemPrice: item.unitPriceArs,
  }));
  // Transferencia aprobada en Admin > Comprobantes: el pedido queda PAID.
  const isTransferApproved = !isMercadoPago && order.paymentStatus === "PAID";
  const isPaid = order.paymentStatus === "PAID";
  const isRejected = order.paymentStatus === "CANCELLED" || order.paymentStatus === "EXPIRED";
  // Una sola línea de estado, corta.
  const statusCopy = isPaid
    ? "Tu pago está aprobado. Ya estamos preparando tu pedido."
    : isRejected
      ? "El pago no se completó. Si necesitás ayuda, escribinos por WhatsApp."
      : isMercadoPago
        ? "Estamos esperando la confirmación de Mercado Pago."
        : "Recibimos tu comprobante. Te avisamos por mail cuando lo confirmemos.";

  return (
    <Container className="py-16">
      <Card className="mx-auto max-w-xl space-y-6 p-6 text-center md:p-8">
        {shouldTrackAnalyticsPurchase ? (
            <TrackEventOnView
              eventName="purchase"
              dedupeKey={`purchase:${order.publicOrderNumber}`}
              params={{
                transaction_id: order.publicOrderNumber,
                currency: order.currency,
                value: productsValue,
                shipping: order.shippingArs,
                coupon: order.couponCode ?? undefined,
                payment_type: order.paymentMethod,
                items: order.items.map((item) => ({
                  item_id: item.productId ?? item.id,
                  item_name: item.productNameSnapshot,
                  item_category: "Productos",
                  price: item.unitPriceArs,
                  quantity: item.quantity,
                })),
              }}
            />
        ) : null}
        {shouldTrackMetaPurchase ? (
            <MetaPixelPurchase
              orderNumber={order.publicOrderNumber}
              totalArs={order.totalArs}
              shippingArs={order.shippingArs}
              items={purchaseItems}
            />
        ) : null}
<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-4xl leading-none text-brand-ink md:text-5xl">¡Gracias, {order.customerFirstName}!</h1>
          <p className="text-brand-ink/70">{statusCopy}</p>
        </div>

        <div className="rounded-[2rem] bg-brand-pinkSoft/30 px-6 py-5">
          <p className="text-sm font-bold text-brand-ink/60">{isPaid ? "Pagaste" : "Total"}</p>
          <p className="font-display text-5xl leading-tight text-brand-ink">{formatArs(order.totalArs)}</p>
          <p className="mt-1 text-sm text-brand-ink/60">
            Pedido <span className="font-extrabold text-brand-ink">N° {order.publicOrderNumber}</span>
          </p>
          <details className="mt-3 text-left text-sm text-brand-ink/70">
            <summary className="cursor-pointer text-center text-xs font-bold text-brand-ink/50 hover:text-brand-ink">Ver detalle</summary>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span>Productos</span>
                <span className="font-bold text-brand-ink">{formatArs(order.subtotalArs)}</span>
              </div>
              {order.discountArs > 0 ? (
                <div className="flex items-center justify-between">
                  <span>Cupón {order.couponCode}</span>
                  <span className="font-bold text-green-700">- {formatArs(order.discountArs)}</span>
                </div>
              ) : null}
              {order.paymentMethodDiscountArs > 0 ? (
                <div className="flex items-center justify-between">
                  <span>Descuento transferencia</span>
                  <span className="font-bold text-green-700">- {formatArs(order.paymentMethodDiscountArs)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span>Envío</span>
                <span className="font-bold text-brand-ink">{order.shippingArs > 0 ? formatArs(order.shippingArs) : "Gratis"}</span>
              </div>
            </div>
          </details>
        </div>

        <OrderShippingStatus orderNumber={order.publicOrderNumber} />

        <Link href="/productos" className="inline-block text-sm font-extrabold text-brand-ink/60 underline-offset-4 hover:text-brand-pink hover:underline">
          Volver a la tienda
        </Link>
      </Card>
    </Container>
  );
}
