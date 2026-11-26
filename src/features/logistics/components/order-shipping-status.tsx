import { computeDispatchDate, dateKeyToDbDate, dbDateToKey, formatDispatchDate } from "@/features/logistics/business-days";
import { arrivalLabelFor } from "@/features/logistics/shipments";
import { getHolidayCalendar, getShippingSettings } from "@/features/logistics/settings";
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
      postalCode: true,
      locality: true,
      province: true,
      shipment: { select: { status: true, trackingNumber: true, dispatchDate: true } },
    },
  });
  if (!order?.shippingCarrier || !order.shipment) return null;
  const shipment = order.shipment;
  const created = shipment.status === "CREATED";
  const confirmed = shipment.status !== "WAITING_PAYMENT" && shipment.status !== "CANCELLED";
  // Confirmado: la fecha que quedó fijada. Sin confirmar: la que correspondería si se confirma ahora
  // (la del día del pedido ya puede haber pasado).
  const dispatchKey = confirmed
    ? shipment.dispatchDate
      ? dbDateToKey(shipment.dispatchDate)
      : order.estimatedDispatchDate
        ? dbDateToKey(order.estimatedDispatchDate)
        : null
    : shipment.status === "CANCELLED"
      ? null
      : computeDispatchDate(new Date(), await getShippingSettings(), await getHolidayCalendar());
  const trackingUrl = trackingUrlFor(order.shippingCarrier, shipment.trackingNumber);
  const isOwn = order.shippingCarrier === "OWN";
  const arrival = dispatchKey ? await arrivalLabelFor(order.shippingCarrier, order, dateKeyToDbDate(dispatchKey)) : null;
  const isBranch = order.shippingDeliveryType === "BRANCH";
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
              "Te lo mandamos por mail cuando se confirme el pago"
            )}
          </p>
        </div>
        {dispatchKey ? (
          <div>
            <p className="text-xs text-brand-ink/55">{confirmed ? "Despachamos el" : "Si se confirma hoy, sale el"}</p>
            <p className="font-bold text-brand-ink">{formatDispatchDate(dispatchKey)}</p>
          </div>
        ) : null}
        {arrival ? (
          <div className="md:col-span-2">
            <p className="text-xs text-brand-ink/55">
              {confirmed ? (isBranch ? "Lo retirás" : "Llega") : isBranch ? "Si se confirma hoy, lo retirás" : "Si se confirma hoy, llega"}
            </p>
            <p className="font-bold text-emerald-700">{arrival.charAt(0).toUpperCase() + arrival.slice(1)}</p>
          </div>
        ) : null}
        {created && trackingUrl ? (
          <div className="md:col-span-2">
            <a
              href={trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-pink px-5 text-sm font-extrabold text-white shadow-sm transition hover:opacity-90"
            >
              Seguir mi envío en {carrierLabels[order.shippingCarrier]}
              <span aria-hidden="true">→</span>
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
