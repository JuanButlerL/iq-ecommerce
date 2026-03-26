import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardMetrics, getOrders } from "@/features/orders/queries";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminDashboardPage() {
  await requireAdmin();
  const [metrics, latestOrders] = await Promise.all([getDashboardMetrics(), getOrders()]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Admin</p>
        <h1 className="mt-2 font-display text-3xl text-brand-ink md:text-5xl">Dashboard</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pedidos totales" value={metrics.totalOrders} />
        <MetricCard label="Pendientes" value={metrics.pendingOrders} />
        <MetricCard label="Sync pendiente" value={metrics.syncPending} />
        <MetricCard label="Productos activos" value={metrics.activeProducts} />
      </div>
      <Card className="p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-brand-ink md:text-2xl">Últimos pedidos</h2>
            <p className="text-sm text-brand-ink/60">Vista operativa rapida para seguimiento.</p>
          </div>
          <Link href="/admin/pedidos">
            <Button variant="secondary">Ver todos</Button>
          </Link>
        </div>
        <div className="space-y-3 md:hidden">
          {latestOrders.slice(0, 6).map((order) => (
            <div key={order.id} className="rounded-[1.5rem] border border-brand-ink/10 bg-background p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-brand-ink">{order.publicOrderNumber}</p>
                  <p className="text-sm text-brand-ink/65">
                    {order.customerFirstName} {order.customerLastName}
                  </p>
                </div>
                <p className="text-sm font-bold text-brand-pink">${order.totalArs.toLocaleString("es-AR")}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-brand-ink/50">
                <span>Pago: {order.paymentStatus}</span>
                <span>Sync: {order.syncStatus}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-brand-ink/50">
                <th className="pb-3">Pedido</th>
                <th className="pb-3">Cliente</th>
                <th className="pb-3">Total</th>
                <th className="pb-3">Pago</th>
                <th className="pb-3">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-ink/10">
              {latestOrders.slice(0, 8).map((order) => (
                <tr key={order.id}>
                  <td className="py-3 font-bold text-brand-ink">{order.publicOrderNumber}</td>
                  <td className="py-3 text-brand-ink/70">
                    {order.customerFirstName} {order.customerLastName}
                  </td>
                  <td className="py-3 text-brand-ink/70">${order.totalArs.toLocaleString("es-AR")}</td>
                  <td className="py-3 text-brand-ink/70">{order.paymentStatus}</td>
                  <td className="py-3 text-brand-ink/70">{order.syncStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50 md:text-sm">{label}</p>
      <p className="mt-3 font-display text-3xl text-brand-pink md:text-4xl">{value}</p>
    </Card>
  );
}
