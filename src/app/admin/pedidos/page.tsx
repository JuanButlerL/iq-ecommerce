import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getOrders } from "@/features/orders/queries";
import { requireAdmin } from "@/lib/auth/admin";

function parseDateParam(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseDateParamEnd(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ dateFrom?: string; dateTo?: string }>;
}) {
  await requireAdmin();
  const resolvedSearchParams = (await searchParams) ?? {};
  const dateFrom = parseDateParam(resolvedSearchParams.dateFrom);
  const dateTo = parseDateParamEnd(resolvedSearchParams.dateTo);
  const orders = await getOrders({ dateFrom, dateTo });
  const exportHref = `/api/admin/export/orders?${new URLSearchParams({
    ...(resolvedSearchParams.dateFrom ? { dateFrom: resolvedSearchParams.dateFrom } : {}),
    ...(resolvedSearchParams.dateTo ? { dateTo: resolvedSearchParams.dateTo } : {}),
  }).toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Pedidos</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Listado</h1>
        </div>
        <Link href={exportHref}>
          <Button variant="secondary" className="w-full sm:w-auto">Exportar Excel</Button>
        </Link>
      </div>
      <Card className="p-4 md:p-6">
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label>
            <span className="mb-2 block text-sm font-bold text-brand-ink/75">Fecha desde</span>
            <input
              type="date"
              name="dateFrom"
              defaultValue={resolvedSearchParams.dateFrom ?? ""}
              className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-bold text-brand-ink/75">Fecha hasta</span>
            <input
              type="date"
              name="dateTo"
              defaultValue={resolvedSearchParams.dateTo ?? ""}
              className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
            />
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" className="w-full sm:w-auto">
              Filtrar
            </Button>
            <Link href="/admin/pedidos" className="w-full sm:w-auto">
              <Button type="button" variant="ghost" className="w-full sm:w-auto">
                Limpiar
              </Button>
            </Link>
          </div>
        </form>
      </Card>
      <Card className="p-6">
        <div className="space-y-3 md:hidden">
          {orders.map((order) => (
            <Link key={order.id} href={`/admin/pedidos/${order.id}`} className="block rounded-[1.5rem] border border-brand-ink/10 bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-brand-ink">{order.publicOrderNumber}</p>
                  <p className="truncate text-sm text-brand-ink/65">
                    {order.customerFirstName} {order.customerLastName}
                  </p>
                </div>
                <p className="text-sm font-bold text-brand-pink">${order.totalArs.toLocaleString("es-AR")}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-ink/50">
                <span>{order.orderStatus}</span>
                <span>{order.paymentStatus}</span>
                <span>Sync: {order.syncStatus}</span>
                <span>{order.paymentProofs[0] ? "Con comprobante" : "Sin comprobante"}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[760px] text-left text-sm">
            <thead>
              <tr className="text-brand-ink/50">
                <th className="pb-3">Pedido</th>
                <th className="pb-3">Cliente</th>
                <th className="pb-3">Estado</th>
                <th className="pb-3">Pago</th>
                <th className="pb-3">Comprobante</th>
                <th className="pb-3">Sync</th>
                <th className="pb-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-ink/10">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="py-3">
                    <Link href={`/admin/pedidos/${order.id}`} className="font-bold text-brand-ink">
                      {order.publicOrderNumber}
                    </Link>
                  </td>
                  <td className="py-3 text-brand-ink/70">
                    {order.customerFirstName} {order.customerLastName}
                  </td>
                  <td className="py-3 text-brand-ink/70">{order.orderStatus}</td>
                  <td className="py-3 text-brand-ink/70">{order.paymentStatus}</td>
                  <td className="py-3 text-brand-ink/70">{order.paymentProofs[0] ? "Cargado" : "Pendiente"}</td>
                  <td className="py-3 text-brand-ink/70">{order.syncStatus}</td>
                  <td className="py-3 text-brand-ink/70">${order.totalArs.toLocaleString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
