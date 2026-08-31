import Link from "next/link";
import { MarketingSourceCategory, MarketingSourcePlatform } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getMarketingDashboardData,
  parseMarketingDashboardFilters,
  type MarketingDashboardFilterValues,
} from "@/features/marketing/admin-analytics";
import { requireAdminSection } from "@/lib/auth/admin";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

type SearchParams = MarketingDashboardFilterValues;

function buildQuery(params: SearchParams, overrides: Record<string, string | number | undefined> = {}) {
  const query = new URLSearchParams();
  const merged = { ...params, ...overrides };

  for (const [key, value] of Object.entries(merged)) {
    if (value == null || value === "" || value === "ALL") {
      continue;
    }

    query.set(key, String(value));
  }

  return query.toString();
}

function formatMoney(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

export default async function AdminMarketingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireAdminSection("marketing");
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = parseMarketingDashboardFilters(resolvedSearchParams);
  const data = await getMarketingDashboardData(filters);
  const exportHref = `/api/admin/export/marketing-attribution?${buildQuery(resolvedSearchParams)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Marketing</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Atribucion y recompra</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-ink/70 md:text-base">
            Seguimiento del origen de cada sesion, captura de email, avance a carrito, compra y clientes con recompra.
          </p>
        </div>
        <Link href={exportHref}>
          <Button variant="secondary" className="w-full sm:w-auto">Exportar Excel</Button>
        </Link>
      </div>

      <Card className="p-4 md:p-6">
        <form className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label>
              <span className="mb-2 block text-sm font-bold text-brand-ink/75">Buscar</span>
              <input
                type="search"
                name="search"
                defaultValue={resolvedSearchParams.search ?? ""}
                placeholder="Email, campana, referrer, pagina"
                className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
              />
            </label>
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
            <label>
              <span className="mb-2 block text-sm font-bold text-brand-ink/75">Categoria</span>
              <select
                name="sourceCategory"
                defaultValue={filters.sourceCategory}
                className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm font-bold text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
              >
                <option value="ALL">Todas</option>
                {Object.values(MarketingSourceCategory).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm font-bold text-brand-ink/75">Plataforma</span>
              <select
                name="sourcePlatform"
                defaultValue={filters.sourcePlatform}
                className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm font-bold text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
              >
                <option value="ALL">Todas</option>
                {Object.values(MarketingSourcePlatform).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-3 text-sm font-bold text-brand-ink/75">
              <input type="checkbox" name="onlyRepeat" value="1" defaultChecked={filters.onlyRepeat} className="h-4 w-4 rounded border-brand-ink/20" />
              Ver solo clientes con recompra
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" className="w-full sm:w-auto">Filtrar</Button>
              <Link href="/admin/marketing" className="w-full sm:w-auto">
                <Button type="button" variant="ghost" className="w-full sm:w-auto">Limpiar</Button>
              </Link>
            </div>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink/45">Sesiones</p><p className="mt-3 text-3xl font-extrabold text-brand-ink">{data.summary.sessions.toLocaleString("es-AR")}</p><p className="mt-2 text-sm text-brand-ink/60">Primeras entradas registradas</p></Card>
        <Card className="p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink/45">Emails captados</p><p className="mt-3 text-3xl font-extrabold text-brand-ink">{data.summary.emailsCaptured.toLocaleString("es-AR")}</p><p className="mt-2 text-sm text-brand-ink/60">Popup o captura en carrito</p></Card>
        <Card className="p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink/45">Compras confirmadas</p><p className="mt-3 text-3xl font-extrabold text-brand-ink">{data.summary.confirmedOrders.toLocaleString("es-AR")}</p><p className="mt-2 text-sm text-brand-ink/60">Ingreso confirmado por pago</p></Card>
        <Card className="p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink/45">Facturacion atribuida</p><p className="mt-3 text-3xl font-extrabold text-brand-pink">{formatMoney(data.summary.confirmedRevenue)}</p><p className="mt-2 text-sm text-brand-ink/60">Sobre compras confirmadas</p></Card>
        <Card className="p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink/45">Clientes unicos</p><p className="mt-3 text-3xl font-extrabold text-brand-ink">{data.summary.uniqueCustomers.toLocaleString("es-AR")}</p><p className="mt-2 text-sm text-brand-ink/60">Con al menos una compra confirmada</p></Card>
        <Card className="p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink/45">Clientes con recompra</p><p className="mt-3 text-3xl font-extrabold text-brand-ink">{data.summary.repeatCustomers.toLocaleString("es-AR")}</p><p className="mt-2 text-sm text-brand-ink/60">2 o mas compras confirmadas</p></Card>
        <Card className="p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink/45">% recompra</p><p className="mt-3 text-3xl font-extrabold text-brand-ink">{formatPercent(data.summary.repeatCustomerRate)}</p><p className="mt-2 text-sm text-brand-ink/60">Sobre clientes con compra confirmada</p></Card>
        <Card className="p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-ink/45">Facturacion recompra</p><p className="mt-3 text-3xl font-extrabold text-brand-ink">{formatMoney(data.summary.repeatRevenue)}</p><p className="mt-2 text-sm text-brand-ink/60">Ingresos de clientes recurrentes</p></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand-pink">Canales</p>
              <h2 className="text-2xl font-extrabold text-brand-ink">Rendimiento por origen</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] text-left text-sm">
              <thead>
                <tr className="text-brand-ink/50">
                  <th className="pb-3">Origen</th>
                  <th className="pb-3">Sesiones</th>
                  <th className="pb-3">Popup</th>
                  <th className="pb-3">Carrito</th>
                  <th className="pb-3">Pedidos</th>
                  <th className="pb-3">Compras</th>
                  <th className="pb-3">Recompra</th>
                  <th className="pb-3">Facturacion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-ink/10">
                {data.categoryPerformance.map((row) => (
                  <tr key={row.key}>
                    <td className="py-3 font-bold text-brand-ink">{row.label}</td>
                    <td className="py-3 text-brand-ink/70">{row.sessions.toLocaleString("es-AR")}</td>
                    <td className="py-3 text-brand-ink/70">{row.popupLeads.toLocaleString("es-AR")}</td>
                    <td className="py-3 text-brand-ink/70">{row.cartLeads.toLocaleString("es-AR")}</td>
                    <td className="py-3 text-brand-ink/70">{row.ordersCreated.toLocaleString("es-AR")}</td>
                    <td className="py-3 text-brand-ink/70">{row.confirmedOrders.toLocaleString("es-AR")}</td>
                    <td className="py-3 text-brand-ink/70">{row.repeatOrders.toLocaleString("es-AR")}</td>
                    <td className="py-3 font-bold text-brand-pink">{formatMoney(row.confirmedRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.categoryPerformance.length === 0 ? <p className="mt-4 text-sm text-brand-ink/60">No hay datos para esos filtros.</p> : null}
        </Card>

        <Card className="p-5 md:p-6">
          <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand-pink">Campanas</p>
          <h2 className="mt-1 text-2xl font-extrabold text-brand-ink">Top rendimiento</h2>
          <div className="mt-5 space-y-3">
            {data.campaignPerformance.slice(0, 12).map((row) => (
              <div key={row.key} className="rounded-[1.25rem] border border-brand-ink/10 bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-brand-ink">{row.campaign}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-brand-ink/45">{row.category} / {row.platform}</p>
                  </div>
                  <p className="text-sm font-extrabold text-brand-pink">{formatMoney(row.confirmedRevenue)}</p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-brand-ink/65">
                  <span>Leads: {row.leadsCaptured.toLocaleString("es-AR")}</span>
                  <span>Compras: {row.confirmedOrders.toLocaleString("es-AR")}</span>
                  <span>Ingreso: {formatMoney(row.confirmedRevenue)}</span>
                </div>
              </div>
            ))}
            {data.campaignPerformance.length === 0 ? <p className="text-sm text-brand-ink/60">Todavia no hay campanas identificadas para estos filtros.</p> : null}
          </div>
        </Card>
      </div>

      <Card className="p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand-pink">Contactos</p>
            <h2 className="text-2xl font-extrabold text-brand-ink">Base accionable para marketing</h2>
          </div>
          <p className="text-sm text-brand-ink/55">{data.contacts.length.toLocaleString("es-AR")} visibles con los filtros actuales</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="text-brand-ink/50">
                <th className="pb-3">Email</th>
                <th className="pb-3">Primer touch</th>
                <th className="pb-3">Ultimo touch</th>
                <th className="pb-3">Campanas asistidas</th>
                <th className="pb-3">Touchpoints</th>
                <th className="pb-3">Popup</th>
                <th className="pb-3">Carrito</th>
                <th className="pb-3">Compras</th>
                <th className="pb-3">Facturacion</th>
                <th className="pb-3">Estado</th>
                <th className="pb-3">Journey</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-ink/10">
              {data.contacts.map((contact) => (
                <tr key={contact.email}>
                  <td className="py-3 font-bold text-brand-ink">{contact.email}</td>
                  <td className="py-3 text-brand-ink/70">{contact.firstTouch ? `${contact.firstTouch.sourceLabel}${contact.firstTouch.utmCampaign ? ` / ${contact.firstTouch.utmCampaign}` : ""}` : "Sin dato"}</td>
                  <td className="py-3 text-brand-ink/70">{contact.lastTouch ? `${contact.lastTouch.sourceLabel}${contact.lastTouch.utmCampaign ? ` / ${contact.lastTouch.utmCampaign}` : ""}` : "Sin dato"}</td>
                  <td className="py-3 text-brand-ink/60">{contact.assistedCampaigns.slice(0, 3).join(" | ") || "-"}</td>
                  <td className="py-3 text-brand-ink/70">{contact.touchpoints}</td>
                  <td className="py-3 text-brand-ink/70">{contact.popupCapturedAt ? formatArgentinaDateTime(contact.popupCapturedAt) : "-"}</td>
                  <td className="py-3 text-brand-ink/70">{contact.cartCapturedAt ? formatArgentinaDateTime(contact.cartCapturedAt) : "-"}</td>
                  <td className="py-3 text-brand-ink/70">{contact.confirmedOrders.toLocaleString("es-AR")}</td>
                  <td className="py-3 font-bold text-brand-pink">{formatMoney(contact.totalRevenue)}</td>
                  <td className="py-3 text-brand-ink/70">{contact.repeatCustomer ? "Recompra" : contact.confirmedOrders > 0 ? "Cliente" : "Lead"}</td>
                  <td className="py-3 text-brand-ink/60">{contact.journeySummary || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.contacts.length === 0 ? <p className="mt-4 text-sm text-brand-ink/60">No hay contactos para estos filtros.</p> : null}
      </Card>

      <Card className="p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand-pink">Pedidos</p>
            <h2 className="text-2xl font-extrabold text-brand-ink">Ultimos pedidos dentro del filtro</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[860px] text-left text-sm">
            <thead>
              <tr className="text-brand-ink/50">
                <th className="pb-3">Pedido</th>
                <th className="pb-3">Email</th>
                <th className="pb-3">Creado</th>
                <th className="pb-3">Pagado</th>
                <th className="pb-3">Ultimo touch</th>
                <th className="pb-3">Primer touch</th>
                <th className="pb-3">Campanas asistidas</th>
                <th className="pb-3">Recompra</th>
                <th className="pb-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-ink/10">
              {data.recentOrders.map((order) => (
                <tr key={order.orderNumber}>
                  <td className="py-3 font-bold text-brand-ink">{order.orderNumber}</td>
                  <td className="py-3 text-brand-ink/70">{order.email}</td>
                  <td className="py-3 text-brand-ink/70">{formatArgentinaDateTime(order.createdAt)}</td>
                  <td className="py-3 text-brand-ink/70">{order.paidAt ? formatArgentinaDateTime(order.paidAt) : "-"}</td>
                  <td className="py-3 text-brand-ink/70">{order.lastTouchLabel}{order.lastCampaign ? ` / ${order.lastCampaign}` : ""}</td>
                  <td className="py-3 text-brand-ink/70">{order.firstTouchLabel}{order.firstCampaign ? ` / ${order.firstCampaign}` : ""}</td>
                  <td className="py-3 text-brand-ink/60">{order.assistedCampaigns || "-"}</td>
                  <td className="py-3 text-brand-ink/70">{order.repeatCustomer ? "Si" : "No"}</td>
                  <td className="py-3 font-bold text-brand-pink">{formatMoney(order.totalArs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.recentOrders.length === 0 ? <p className="mt-4 text-sm text-brand-ink/60">No hay pedidos para estos filtros.</p> : null}
      </Card>
    </div>
  );
}

