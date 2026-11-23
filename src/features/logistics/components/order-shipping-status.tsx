import { dbDateToKey, formatDispatchDate } from "@/features/logistics/business-days";
import { AutoRefresh } from "@/features/logistics/components/auto-refresh";
import { trackingUrlFor } from "@/features/logistics/shipping-email";
import { prisma } from "@/lib/db/prisma";

const carrierLabels = { OWN: "Reparto IQ Kids", ANDREANI: "Andreani", CORREO_AR: "Correo Argentino" } as const;

// Bloque de envío de la pantalla de confirmación (tienda y mayoristas): transportista, seguimiento y despacho.
export async function OrderShippingStatus({ orderNumber }: { orderNumber: string }) {
  const order = await prisma.order.findUnique({
    where: { publicOrderNumber: orderNumber },
    select: {
      paymentMethod: true,
      paymentStatus: true,
      shippingCarrier: true,
      shippingDeliveryType: true,
      shippingBranchName: true,
      shippingBranchAddress: true,
      estimatedDispatchDate: true,
      shipment: { select: { status: true, trackingNumber: true, dispatchDate: true } },
    },
  });
  if (!order?.shippingCarrier || !order.shipment) return null;
  const shipment = order.shipment;
  const created = shipment.status === "CREATED";
  const confirmed = shipment.status !== "WAITING_PAYMENT" && shipment.status !== "CANCELLED";
  const dispatch = shipment.dispatchDate ?? order.estimatedDispatchDate;
  const trackingUrl = trackingUrlFor(order.shippingCarrier, shipment.trackingNumber);
  const isOwn = order.shippingCarrier === "OWN";
  // Mercado Pago avisa el pago unos segundos después de volver: la página se actualiza sola un rato.
  const waitingForCarrier = !created && (shipment.status === "PENDING" || shipment.status === "PROCESSING" || (order.paymentMethod === "MERCADO_PAGO" && order.paymentStatus !== "PAID"));

  return (
    <div className="rounded-[1.5rem] bg-background p-5 text-left">
      {waitingForCarrier ? <AutoRefresh seconds={6} times={8} /> : null}
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Envío</p>
      <p className="mt-2 font-bold text-brand-ink">
        {carrierLabels[order.shippingCarrier]} · {order.shippingDeliveryType === "BRANCH" ? "retiro en sucursal" : "a domicilio"}
      </p>
      {order.shippingDeliveryType === "BRANCH" && order.shippingBranchName ? (
        <p className="text-sm text-brand-ink/70">{[order.shippingBranchName, order.shippingBranchAddress].filter(Boolean).join(" · ")}</p>
      ) : null}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs text-brand-ink/55">{isOwn ? "Número de pedido" : "Número de seguimiento"}</p>
          <p className="font-bold text-brand-ink">
            {created && shipment.trackingNumber ? (
              trackingUrl ? (
                <a href={trackingUrl} target="_blank" rel="noreferrer" className="text-brand-pink hover:underline">{shipment.trackingNumber}</a>
              ) : (
                shipment.trackingNumber
              )
            ) : confirmed ? (
              "Lo estamos generando, te llega por mail"
            ) : order.paymentMethod === "MERCADO_PAGO" ? (
              "Te lo mandamos cuando se acredite el pago"
            ) : (
              "Te lo mandamos por mail cuando aprobemos el comprobante"
            )}
          </p>
        </div>
        {dispatch ? (
          <div>
            <p className="text-xs text-brand-ink/55">{confirmed ? "Despachamos el" : "Si se confirma hoy, sale el"}</p>
            <p className="font-bold text-brand-ink">{formatDispatchDate(dbDateToKey(dispatch))}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
