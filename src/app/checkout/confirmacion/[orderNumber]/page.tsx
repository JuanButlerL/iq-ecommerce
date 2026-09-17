import Link from "next/link";
import { notFound } from "next/navigation";

import { MetaPixelPurchase } from "@/components/analytics/meta-pixel-purchase";
import { TrackEventOnView } from "@/components/analytics/track-event-on-view";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCouponDiscountLabel } from "@/features/coupons/lib/coupon-pricing";
import { getOrderByNumber } from "@/features/orders/services/order-service";
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
  const paymentCopy = isMercadoPago
    ? order.paymentStatus === "PAID"
      ? "Mercado Pago confirmo el pago y el pedido ya quedo registrado."
      : "Tu pedido esta guardado. Estamos esperando la confirmacion final de Mercado Pago."
    : "Tu comprobante ya fue enviado. Si el equipo necesita algo mas, te contacta con estos datos.";
  const successCopy = isMercadoPago
    ? "Recibimos tu pedido y seguimos la confirmacion del pago online."
    : settings?.purchaseSuccessMessage ??
      "Recibimos tu comprobante. Vamos a validar el pago y seguir con la preparacion del pedido.";

  return (
    <Container className="py-16">
      <Card className="mx-auto max-w-3xl space-y-6 p-8 text-center">
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
<p className="text-sm font-extrabold uppercase tracking-[0.18em] text-emerald-600">Compra confirmada</p>        <h1 className="font-display text-5xl leading-none text-brand-ink">Gracias por tu compra</h1>
        <p className="text-brand-ink/70">{successCopy}</p>
        <div className="rounded-[2rem] bg-brand-peach p-6">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Pedido</p>
          <p className="mt-2 text-2xl font-extrabold text-brand-ink">{order.publicOrderNumber}</p>
          <p className="mt-4 text-4xl font-extrabold text-brand-pink">{formatArs(order.totalArs)}</p>
          <div className="mt-4 space-y-2 text-left text-sm text-brand-ink/70">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-bold text-brand-ink">{formatArs(order.subtotalArs)}</span>
            </div>
            {order.discountArs > 0 ? (
              <div className="flex items-center justify-between">
                <span>
                  Cupon {order.couponCode}{" "}
                  {order.coupon
                    ? `(${getCouponDiscountLabel({
                        discountType: order.coupon.discountType,
                        discountPercentage: order.discountPercentage == null ? null : Number(order.discountPercentage),
                        fixedDiscountArs: order.coupon.fixedDiscountArs,
                      })})`
                    : ""}
                </span>
                <span className="font-bold text-green-700">- {formatArs(order.discountArs)}</span>
              </div>
            ) : null}
            {order.paymentMethodDiscountArs > 0 ? (
              <div className="flex items-center justify-between">
                <span>Descuento transferencia ({Number(order.paymentMethodDiscountPercentage ?? 0)}%)</span>
                <span className="font-bold text-green-700">- {formatArs(order.paymentMethodDiscountArs)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span>Envio</span>
              <span className="font-bold text-brand-ink">{formatArs(order.shippingArs)}</span>
            </div>
          </div>
          <p className="mt-4 text-sm text-brand-ink/70">{paymentCopy}</p>
        </div>
        <div className="grid gap-3 text-left md:grid-cols-3">
          <div className="rounded-[1.5rem] bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Estado actual</p>
            <p className="mt-2 font-bold text-brand-ink">
              {isMercadoPago ? order.paymentProviderStatus ?? order.paymentStatus : "Pago en revision"}
            </p>
          </div>
          <div className="rounded-[1.5rem] bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Pedido</p>
            <p className="mt-2 font-bold text-brand-ink">{order.publicOrderNumber}</p>
          </div>
          <div className="rounded-[1.5rem] bg-background p-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">
              {isMercadoPago ? "Medio de pago" : "Contacto"}
            </p>
            <p className="mt-2 font-bold text-brand-ink">{isMercadoPago ? "Mercado Pago" : order.customerEmail}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/productos">
            <Button>Seguir comprando</Button>
          </Link>
          <Link href="/contacto">
            <Button variant="secondary">Necesito ayuda</Button>
          </Link>
        </div>
      </Card>
    </Container>
  );
}
