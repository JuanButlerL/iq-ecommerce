import Link from "next/link";

import { Card } from "@/components/ui/card";
import { getShipmentsAdminData } from "@/features/logistics/admin";
import { formatDispatchDate } from "@/features/logistics/business-days";
import { SHIPMENT_STATUS_LABELS } from "@/features/logistics/components/order-shipment-card";
import { requireAdminSection } from "@/lib/auth/admin";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

export const dynamic = "force-dynamic";

const carrierLabels: Record<string, string> = { OWN: "Propio", ANDREANI: "Andreani", CORREO_AR: "Correo" };

type Row = Awaited<ReturnType<typeof getShipmentsAdminData>>["recent"][number];

function ShipmentTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="text-left text-xs text-brand-ink/55">
          <tr>
            <th className="py-2">Pedido</th>
            <th>Cliente</th>
            <th>Envío</th>
            <th>Estado</th>
            <th>Seguimiento</th>
            <th>Despacho</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-brand-ink/5 align-top">
              <td className="py-2 font-bold">
                <Link href={`/admin/pedidos/${row.orderId}`} className="hover:text-brand-pink">{row.orderNumber}</Link>
                {row.channel === "WHOLESALE" ? <span className="ml-1 text-xs text-brand-ink/50">(may.)</span> : null}
              </td>
              <td>{row.customer}</td>
              <td>{carrierLabels[row.carrier]} · {row.deliveryType === "BRANCH" ? "sucursal" : "domicilio"}</td>
              <td>
                <span className={row.status === "NEEDS_REVIEW" || (row.status === "ERROR" && row.attempts >= 4) ? "font-bold text-red-700" : ""}>
                  {SHIPMENT_STATUS_LABELS[row.status] ?? row.status}
                </span>
                {row.lastError && row.status !== "CREATED" ? <p className="max-w-xs text-xs text-red-700">{row.lastError}</p> : null}
                {row.status === "ERROR" && row.nextAttemptAt ? <p className="text-xs text-brand-ink/50">Próximo intento {formatArgentinaDateTime(row.nextAttemptAt)}</p> : null}
              </td>
              <td>{row.trackingNumber ?? "—"}</td>
              <td>{row.dispatchDate ? formatDispatchDate(row.dispatchDate) : "—"}</td>
              <td>
                {row.hasLabel ? (
                  <a href={`/api/admin/shipments/${row.id}/label`} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-pink hover:underline">Etiqueta</a>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminLabelsPage() {
  await requireAdminSection("orders");
  const data = await getShipmentsAdminData();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-pink">Ventas</p>
        <h1 className="font-display text-4xl text-brand-ink">Etiquetas y envíos</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-ink/70">
          Las etiquetas se generan solas al confirmarse el pago y se reintentan cada vez más espaciado si el transportista falla. Desde el pedido podés reintentar,
          cargar un seguimiento a mano o subir la etiqueta.
        </p>
      </div>
      <Card className={`space-y-3 p-5 ${data.attention.length ? "ring-2 ring-red-300" : ""}`}>
        <h2 className="font-display text-2xl text-brand-ink">Para revisar ({data.attention.length})</h2>
        {data.attention.length ? <ShipmentTable rows={data.attention} /> : <p className="text-sm text-brand-ink/60">Todo en orden.</p>}
      </Card>
      <Card className="space-y-3 p-5">
        <h2 className="font-display text-2xl text-brand-ink">Últimos 14 días</h2>
        {data.recent.length ? <ShipmentTable rows={data.recent} /> : <p className="text-sm text-brand-ink/60">Todavía no hay envíos.</p>}
      </Card>
    </div>
  );
}
