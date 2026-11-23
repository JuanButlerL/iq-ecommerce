import { Card } from "@/components/ui/card";
import { dbDateToKey, formatDispatchDate } from "@/features/logistics/business-days";
import { ShipmentActions } from "@/features/logistics/components/shipment-actions";
import { trackingUrlFor } from "@/features/logistics/shipping-email";
import { prisma } from "@/lib/db/prisma";
import { formatArs } from "@/lib/utils/currency";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

const carrierLabels = { OWN: "Reparto propio", ANDREANI: "Andreani", CORREO_AR: "Correo Argentino" } as const;
export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  WAITING_PAYMENT: "Esperando el pago",
  PENDING: "Por generar",
  PROCESSING: "Generando",
  CREATED: "Etiqueta generada",
  ERROR: "Falló, se reintenta solo",
  NEEDS_REVIEW: "Revisar a mano",
  CANCELLED: "Cancelado",
};
const priceSourceLabels: Record<string, string> = {
  LIVE: "cotizado en el momento",
  CACHED: "última cotización guardada",
  FALLBACK: "tabla por provincia (sin cotización)",
  OWN_ZONE: "zona propia",
  LEGACY: "tabla por provincia",
};

// Envío del pedido en el admin: transportista, estado de la etiqueta, historial y acciones.
export async function OrderShipmentCard({ orderId }: { orderId: string }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      shippingCarrier: true,
      shippingDeliveryType: true,
      shippingBranchName: true,
      shippingBranchAddress: true,
      shippingCarrierPriceArs: true,
      shippingPriceSource: true,
      shippingZoneName: true,
      shipment: { include: { events: { orderBy: { createdAt: "desc" }, take: 15 } } },
    },
  });
  if (!order?.shippingCarrier || !order.shipment) return null;
  const shipment = order.shipment;
  const alert = shipment.status === "NEEDS_REVIEW" || (shipment.status === "ERROR" && shipment.attempts >= 4);
  const trackingUrl = trackingUrlFor(shipment.carrier, shipment.trackingNumber);

  return (
    <Card className={`space-y-4 p-6 ${alert ? "ring-2 ring-red-300" : ""}`}>
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Envío</p>
        <p className="mt-1 font-display text-2xl text-brand-ink">
          {carrierLabels[order.shippingCarrier]} · {order.shippingDeliveryType === "BRANCH" ? "retiro en sucursal" : "a domicilio"}
        </p>
        <p className={`text-sm font-bold ${alert ? "text-red-700" : "text-brand-ink/70"}`}>{SHIPMENT_STATUS_LABELS[shipment.status] ?? shipment.status}</p>
      </div>
      <dl className="grid gap-2 text-sm text-brand-ink">
        {order.shippingDeliveryType === "BRANCH" ? (
          <div><dt className="text-brand-ink/55">Sucursal</dt><dd className="font-bold">{[order.shippingBranchName, order.shippingBranchAddress].filter(Boolean).join(" · ")}</dd></div>
        ) : null}
        {order.shippingZoneName ? <div><dt className="text-brand-ink/55">Zona</dt><dd className="font-bold">{order.shippingZoneName}</dd></div> : null}
        {order.shippingCarrierPriceArs !== null ? (
          <div>
            <dt className="text-brand-ink/55">Costo del envío</dt>
            <dd className="font-bold">{formatArs(order.shippingCarrierPriceArs)} <span className="font-normal text-brand-ink/55">({priceSourceLabels[order.shippingPriceSource ?? ""] ?? "—"})</span></dd>
          </div>
        ) : null}
        {shipment.trackingNumber ? (
          <div>
            <dt className="text-brand-ink/55">Seguimiento</dt>
            <dd className="font-bold">{trackingUrl ? <a href={trackingUrl} target="_blank" rel="noreferrer" className="text-brand-pink hover:underline">{shipment.trackingNumber}</a> : shipment.trackingNumber}</dd>
          </div>
        ) : null}
        {shipment.dispatchDate ? <div><dt className="text-brand-ink/55">Despacho</dt><dd className="font-bold">{formatDispatchDate(dbDateToKey(shipment.dispatchDate))}</dd></div> : null}
        {shipment.lastError && shipment.status !== "CREATED" ? (
          <div><dt className="text-brand-ink/55">Último error ({shipment.attempts} intentos)</dt><dd className="text-red-700">{shipment.lastError}</dd></div>
        ) : null}
        {shipment.nextAttemptAt && shipment.status === "ERROR" ? (
          <div><dt className="text-brand-ink/55">Próximo intento</dt><dd>{formatArgentinaDateTime(shipment.nextAttemptAt)}</dd></div>
        ) : null}
      </dl>
      {shipment.labelStoragePath ? (
        <a href={`/api/admin/shipments/${shipment.id}/label`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-full bg-brand-pink px-4 text-sm font-bold text-white">
          Ver etiqueta
        </a>
      ) : shipment.status === "CREATED" && shipment.carrier === "CORREO_AR" ? (
        <p className="text-sm text-brand-ink/70">Importado en MiCorreo: la etiqueta se imprime desde el panel de MiCorreo (o subila acá).</p>
      ) : shipment.status === "CREATED" && shipment.carrier === "OWN" ? (
        <p className="text-sm text-brand-ink/70">La etiqueta del reparto propio la genera la app de operaciones.</p>
      ) : null}
      <ShipmentActions shipmentId={shipment.id} status={shipment.status} hasLabel={Boolean(shipment.labelStoragePath)} />
      {shipment.events.length > 0 ? (
        <ul className="space-y-1 border-t border-brand-ink/10 pt-3 text-xs text-brand-ink/70">
          {shipment.events.map((event) => (
            <li key={event.id}>
              <b>{formatArgentinaDateTime(event.createdAt)}</b> · {event.message}
              {event.actor && event.actor !== "sistema" ? <span className="text-brand-ink/45"> ({event.actor})</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
