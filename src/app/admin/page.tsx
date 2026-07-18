import Link from "next/link";
import { Clock3, CreditCard, MessageCircle, Package, ShoppingBag, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardSalesChart } from "@/features/admin/components/dashboard-sales-chart";
import { getAdminDashboardAnalyticsByStatus, type DashboardOrderStatusFilter } from "@/features/orders/queries";
import { requireAdminSection } from "@/lib/auth/admin";
import { formatArs } from "@/lib/utils/currency";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

const orderStatusOptions: Array<{ value: DashboardOrderStatusFilter; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "CONFIRMED", label: "Confirmados" },
  { value: "PENDING", label: "Pendientes" },
];

function normalizeDashboardStatus(value?: string): DashboardOrderStatusFilter {
  if (value === "CONFIRMED" || value === "PENDING") return value;

  return "ALL";
}

function normalizeRecoveryMonth(value?: string) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : "ALL";
}

function buildDashboardHref(status: DashboardOrderStatusFilter, recoveryMonth = "ALL") {
  const params = new URLSearchParams();

  if (status !== "ALL") {
    params.set("status", status);
  }

  if (recoveryMonth !== "ALL") {
    params.set("recoveryMonth", recoveryMonth);
  }

  const query = params.toString();

  return query ? `/admin?${query}` : "/admin";
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; recoveryMonth?: string }>;
}) {
  await requireAdminSection("dashboard");
  const params = await searchParams;
  const selectedStatus = normalizeDashboardStatus(params?.status);
  const selectedRecoveryMonth = normalizeRecoveryMonth(params?.recoveryMonth);
  const analytics = await getAdminDashboardAnalyticsByStatus(selectedStatus, selectedRecoveryMonth);
  const maxProductUnits = Math.max(...analytics.products.map((product) => product.units), 1);
  const maxFlavorUnits = Math.max(...analytics.flavors.map((flavor) => flavor.units), 1);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Admin</p>
          <h1 className="mt-2 font-display text-4xl leading-none text-brand-ink md:text-6xl">Dashboard</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-ink/60 md:text-base">
            Primero el pulso de venta. Despues, que producto empuja, que sabor se mueve y donde se traban los pedidos.
          </p>
        </div>
        <div className="flex flex-row flex-wrap gap-2 xl:justify-end">
          <Link
            href="/admin/pedidos"
            className="rounded-full border border-brand-ink/10 bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-brand-ink/55 transition hover:border-brand-pink/40 hover:text-brand-pink md:text-sm"
          >
            Ver pedidos
          </Link>
          <Link
            href="/admin/sync"
            className="rounded-full border border-brand-ink/10 bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-brand-ink/55 transition hover:border-brand-pink/40 hover:text-brand-pink md:text-sm"
          >
            Sync
          </Link>
        </div>
      </div>

      <section className="rounded-[1.75rem] border border-brand-ink/8 bg-white p-3 shadow-[0_10px_28px_rgba(44,34,65,0.04)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="px-2">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-pink">Filtro global</p>
            <p className="mt-1 text-sm font-bold text-brand-ink/60">
              Impacta KPIs, grafico, rankings, canales, recuperacion y ultimos pedidos.
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:justify-end md:pb-0">
            {orderStatusOptions.map((option) => {
              const isActive = selectedStatus === option.value;
              const href = buildDashboardHref(option.value, selectedRecoveryMonth);

              return (
                <Link
                  key={option.value}
                  href={href}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] transition ${
                    isActive
                      ? "bg-brand-ink text-white shadow-soft"
                      : "border border-brand-ink/10 bg-background text-brand-ink/55 hover:border-brand-pink/30 hover:text-brand-pink"
                  }`}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<ShoppingBag className="h-5 w-5" />}
          label="Facturacion total"
          value={formatArs(analytics.totals.monthGrossRevenue)}
          helper={`${analytics.totals.monthOrders} compras del mes actual`}
        />
        <MetricCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Ticket promedio"
          value={formatArs(analytics.totals.averagePaidTicket)}
          helper="Promedio de lo que paga el cliente"
        />
        <MetricCard
          icon={<Truck className="h-5 w-5" />}
          label="Flete promedio"
          value={formatArs(analytics.totals.averageShipping)}
          helper="Promedio de envio facturado"
        />
        <MetricCard
          icon={<Package className="h-5 w-5" />}
          label="Cantidad promedio"
          value={analytics.totals.averageUnits.toLocaleString("es-AR", {
            minimumFractionDigits: analytics.totals.averageUnits % 1 === 0 ? 0 : 1,
            maximumFractionDigits: 1,
          })}
          helper={`${analytics.totals.monthUnits.toLocaleString("es-AR")} unidades vendidas`}
        />
      </section>

      <DashboardSalesChart series={{ daily: analytics.daily, weekly: analytics.weekly, monthly: analytics.monthly }} />

      <section className="grid gap-4 xl:grid-cols-3">
        <RankingCard
          title="Productos por unidades"
          eyebrow="Top ventas"
          items={analytics.products.map((product) => ({
            label: product.name,
            value: product.units,
            detail: formatArs(product.revenue),
            percent: (product.units / maxProductUnits) * 100,
          }))}
        />
        <RankingCard
          title="Sabor / variedad"
          eyebrow="Demanda"
          items={analytics.flavors.map((flavor) => ({
            label: flavor.name,
            value: flavor.units,
            detail: formatArs(flavor.revenue),
            percent: (flavor.units / maxFlavorUnits) * 100,
          }))}
        />
        <Card className="p-5 md:p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Canales</p>
          <h2 className="mt-1 font-display text-3xl leading-none text-brand-ink">Origen y pago</h2>
          <div className="mt-5 space-y-5">
            <Breakdown title="Metodo de pago" items={analytics.payments.map((item) => `${item.name}: ${item.orders} pedidos - ${formatArs(item.revenue)}`)} />
            <Breakdown title="Fuente registrada" items={analytics.sources.map((item) => `${item.name}: ${item.orders} pedidos - ${formatArs(item.revenue)}`)} />
          </div>
          <p className="mt-5 rounded-[1.25rem] bg-background px-4 py-3 text-xs leading-5 text-brand-ink/55">
            Para campanas Meta/Google con nombre exacto hace falta guardar UTMs en el pedido. Hoy la base solo registra fuente general.
          </p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="p-5 md:p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Recuperacion</p>
          <h2 className="mt-1 font-display text-3xl leading-none text-brand-ink">Pedidos para contactar</h2>
          <p className="mt-2 text-sm leading-6 text-brand-ink/55">
            Pendientes sin compra posterior detectada por email, telefono o DNI.
          </p>
          {analytics.recoveryMonths.length > 1 ? (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              <Link
                href={buildDashboardHref(selectedStatus)}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-extrabold uppercase tracking-[0.12em] transition ${
                  selectedRecoveryMonth === "ALL"
                    ? "bg-brand-ink text-white shadow-soft"
                    : "border border-brand-ink/10 bg-background text-brand-ink/55 hover:border-brand-pink/30 hover:text-brand-pink"
                }`}
              >
                Todos
              </Link>
              {analytics.recoveryMonths.map((month) => (
                <Link
                  key={month.value}
                  href={buildDashboardHref(selectedStatus, month.value)}
                  className={`shrink-0 rounded-full px-3 py-2 text-xs font-extrabold uppercase tracking-[0.12em] transition ${
                    selectedRecoveryMonth === month.value
                      ? "bg-brand-ink text-white shadow-soft"
                      : "border border-brand-ink/10 bg-background text-brand-ink/55 hover:border-brand-pink/30 hover:text-brand-pink"
                  }`}
                >
                  {month.label}
                </Link>
              ))}
            </div>
          ) : null}
          <div className="mt-5 space-y-3">
            {analytics.recoveryOrders.length ? (
              analytics.recoveryOrders.map((order) => {
                const whatsappUrl = buildWhatsappUrl(order.customerPhone, order.publicOrderNumber);

                return (
                  <div
                    key={order.id}
                    className="rounded-[1.5rem] border border-brand-ink/10 bg-white p-4 shadow-card"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold text-brand-ink">
                          {order.publicOrderNumber} - {order.customerFirstName} {order.customerLastName}
                        </p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-ink/45">
                          Fecha: {formatArgentinaDateTime(order.createdAt)}
                        </p>
                        <p className="mt-2 text-sm font-bold text-brand-pink">{formatArs(order.productsRevenue)}</p>
                      </div>
                      {whatsappUrl ? (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25d366] px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-white transition hover:-translate-y-0.5 hover:shadow-soft"
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </a>
                      ) : (
                        <span className="rounded-full bg-background px-4 py-2 text-xs font-bold text-brand-ink/45">
                          Sin telefono
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="rounded-[1.5rem] bg-background px-4 py-5 text-sm text-brand-ink/55">
                No hay pendientes accionables ahora.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Minuto a minuto</p>
              <h2 className="mt-1 font-display text-3xl leading-none text-brand-ink">Ultimos pedidos</h2>
            </div>
            <Link href="/admin/pedidos">
              <Button variant="secondary">Ver todos</Button>
            </Link>
          </div>
          <div className="space-y-3">
            {analytics.recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/pedidos/${order.id}`}
                className="group grid gap-3 rounded-[1.5rem] border border-brand-ink/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-brand-pink/40 hover:shadow-soft md:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="font-bold text-brand-ink">
                    {order.publicOrderNumber} - {order.customerFirstName} {order.customerLastName}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-brand-ink/45">
                    <Clock3 className="h-3.5 w-3.5" />
                    Fecha y hora:{" "}
                    {formatArgentinaDateTime(order.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <Pill>{order.paymentStatus}</Pill>
                  <Pill>{order.orderStatus}</Pill>
                  <span className="font-bold text-brand-pink">{formatArs(order.productsRevenue)}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand-pink/10" />
      <div className="relative">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-pink text-white shadow-soft">
          {icon}
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/45">{label}</p>
        <p className="mt-2 text-3xl font-extrabold leading-none text-brand-ink md:text-4xl">{value}</p>
        <p className="mt-2 text-sm font-bold text-brand-pink">{helper}</p>
      </div>
    </Card>
  );
}

function buildWhatsappUrl(phone: string, publicOrderNumber: string) {
  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  const localMobile = digits.replace(/^0+/, "").replace(/^15/, "");
  const normalized = digits.startsWith("54") ? digits : `549${localMobile}`;
  const text = encodeURIComponent(
    `Hola! Te escribo de IQ Kids por tu pedido ${publicOrderNumber}. Quedo pendiente y queria ayudarte a finalizarlo.`,
  );

  return `https://wa.me/${normalized}?text=${text}`;
}

function RankingCard({
  eyebrow,
  title,
  items,
}: {
  eyebrow: string;
  title: string;
  items: Array<{ label: string; value: number; detail: string; percent: number }>;
}) {
  return (
    <Card className="p-5 md:p-6">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">{eyebrow}</p>
      <h2 className="mt-1 font-display text-3xl leading-none text-brand-ink">{title}</h2>
      <div className="mt-5 space-y-4">
        {items.length ? (
          items.map((item) => (
            <div key={item.label}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold leading-tight text-brand-ink">{item.label}</p>
                  <p className="text-xs font-bold text-brand-ink/45">{item.detail}</p>
                </div>
                <p className="font-extrabold text-brand-pink">{item.value}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-brand-pink/10">
                <div className="h-full rounded-full bg-brand-pink" style={{ width: `${Math.max(5, item.percent)}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-brand-ink/55">Todavia no hay ventas en este periodo.</p>
        )}
      </div>
    </Card>
  );
}

function Breakdown({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">{title}</p>
      <div className="space-y-2">
        {items.length ? (
          items.map((item) => (
            <p key={item} className="rounded-2xl bg-background px-4 py-3 text-sm font-bold text-brand-ink/70">
              {item}
            </p>
          ))
        ) : (
          <p className="rounded-2xl bg-background px-4 py-3 text-sm text-brand-ink/55">Sin datos.</p>
        )}
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-brand-pink/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.1em] text-brand-pink">
      {children}
    </span>
  );
}
