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
    <div className="rounded-[2rem] border border-brand-ink/10 p-5 text-left">
      {waitingForCarrier ? <AutoRefresh seconds={6} times={8} /> : null}
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">
        Envío · {carrierLabels[order.shippingCarrier]} {isBranch ? "a sucursal" : "a domicilio"}
      </p>
      {arrival ? (
        <p className="mt-2 text-lg font-extrabold leading-snug text-emerald-700">
          {confirmed ? (isBranch ? "Lo retirás " : "Llega ") : isBranch ? "Si se confirma hoy, lo retirás " : "Si se confirma hoy, llega "}
          {arrival}
        </p>
      ) : dispatchKey ? (
        <p className="mt-2 text-lg font-extrabold text-brand-ink">Sale el {formatDispatchDate(dispatchKey)}</p>
      ) : null}
      {isBranch && order.shippingBranchName ? (
        <p className="mt-1 text-sm text-brand-ink/70">{[order.shippingBranchName, order.shippingBranchAddress].filter(Boolean).join(" · ")}</p>
      ) : null}
      {created && shipment.trackingNumber ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background p-3">
          <div>
            <p className="text-xs text-brand-ink/55">{isOwn ? "Número de pedido" : "Número de seguimiento"}</p>
            <p className="font-extrabold tracking-wide text-brand-ink">{shipment.trackingNumber}</p>
          </div>
          {trackingUrl ? (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-pink px-5 text-sm font-extrabold text-white shadow-sm transition hover:opacity-90"
            >
              Seguir mi envío <span aria-hidden="true">→</span>
            </a>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-brand-ink/60">
          {confirmed
            ? isOwn
              ? "Te escribimos por WhatsApp cuando salga."
              : "Te mandamos el número de seguimiento por mail."
            : order.paymentMethod === "MERCADO_PAGO"
              ? "Te mandamos el seguimiento por mail cuando se acredite el pago."
              : "Te mandamos el seguimiento por mail cuando se confirme el pago."}
        </p>
      )}
    </div>
  );
}
