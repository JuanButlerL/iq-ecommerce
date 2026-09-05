import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Download, Filter, MousePointerClick, ShoppingBag, UsersRound } from "lucide-react";
import { MarketingSourceCategory, MarketingSourcePlatform } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMarketingDashboardData, parseMarketingDashboardFilters, type MarketingDashboardFilterValues } from "@/features/marketing/admin-analytics";
import { requireAdminSection } from "@/lib/auth/admin";
import { formatArs } from "@/lib/utils/currency";
import { getArgentinaDateKey } from "@/lib/utils/datetime";

type SearchParams = MarketingDashboardFilterValues;

function buildQuery(params: SearchParams, overrides: Record<string, string | number | undefined> = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...overrides })) {
    if (value != null && value !== "" && value !== "ALL") query.set(key, String(value));
  }
  return query.toString();
}

function formatPercent(value: number) {
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

function sourceName(category: string, platform: string) {
  return `${category === "ORGANIC" ? "Orgánico" : category} · ${platform}`;
}

export default async function AdminMarketingPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  await requireAdminSection("marketing");
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = parseMarketingDashboardFilters(resolvedSearchParams);
  const data = await getMarketingDashboardData(filters);
  const exportQuery = buildQuery(resolvedSearchParams, {
    dateFrom: resolvedSearchParams.dateFrom ?? (filters.dateFrom ? getArgentinaDateKey(filters.dateFrom) : undefined),
    dateTo: resolvedSearchParams.dateTo ?? (filters.dateTo ? getArgentinaDateKey(filters.dateTo) : undefined),
  });
  const conversionRate = data.summary.sessions ? (data.summary.confirmedOrders / data.summary.sessions) * 100 : 0;
  const maxRevenue = Math.max(...data.categoryPerformance.map((row) => row.confirmedRevenue), 1);
  const campaignsToScale = data.campaignPerformance.filter((campaign) => campaign.confirmedOrders > 0).slice(0, 5);
  const campaignsToReview = data.campaignPerformance.filter((campaign) => campaign.sessions >= 5 && campaign.confirmedOrders === 0).sort((a, b) => b.sessions - a.sessions).slice(0, 4);
  const funnel = [
    { label: "Sesiones", value: data.summary.sessions, tone: "bg-brand-ink" },
    { label: "Emails captados", value: data.summary.emailsCaptured, tone: "bg-brand-pink" },
    { label: "Pedidos creados", value: data.summary.ordersCreated, tone: "bg-[#f5bd53]" },
    { label: "Compras confirmadas", value: data.summary.confirmedOrders, tone: "bg-[#43a77b]" },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <section className="rounded-[2rem] bg-brand-ink px-5 py-6 text-white shadow-card md:px-8 md:py-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-pink">Performance de marketing</p><h1 className="mt-2 font-display text-4xl leading-none md:text-6xl">Qué está generando ventas</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 md:text-base">Lectura de atribución propia de IQ Kids. Usá el período y los canales para decidir qué escalar, qué optimizar y qué investigar.</p></div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link href={`/api/admin/export/marketing-sales?${exportQuery}`} className="contents"><Button className="w-full bg-brand-pink text-white hover:bg-brand-pink/90 sm:w-auto"><Download className="mr-2 h-4 w-4" />Ventas atribuidas</Button></Link>
            <Link href={`/api/admin/export/marketing-attribution?${exportQuery}`} className="contents"><Button variant="secondary" className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20 sm:w-auto"><UsersRound className="mr-2 h-4 w-4" />Contactos y embudo</Button></Link>
          </div>
        </div>
      </section>

      <Card className="p-4 md:p-6"><form className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><DateField label="Desde" name="dateFrom" value={filters.dateFrom ? getArgentinaDateKey(filters.dateFrom) : ""} /><DateField label="Hasta" name="dateTo" value={filters.dateTo ? getArgentinaDateKey(filters.dateTo) : ""} /><label><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.13em] text-brand-ink/55">Canal</span><select name="sourceCategory" defaultValue={filters.sourceCategory} className="h-11 w-full rounded-xl border border-brand-ink/10 bg-white px-3 text-sm font-bold"><option value="ALL">Todos los canales</option>{Object.values(MarketingSourceCategory).map((value) => <option key={value} value={value}>{value === "ORGANIC" ? "ORGÁNICO" : value}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.13em] text-brand-ink/55">Plataforma</span><select name="sourcePlatform" defaultValue={filters.sourcePlatform} className="h-11 w-full rounded-xl border border-brand-ink/10 bg-white px-3 text-sm font-bold"><option value="ALL">Todas las plataformas</option>{Object.values(MarketingSourcePlatform).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.13em] text-brand-ink/55">Buscar</span><input type="search" name="search" defaultValue={resolvedSearchParams.search ?? ""} placeholder="Campaña o email" className="h-11 w-full rounded-xl border border-brand-ink/10 px-3 text-sm" /></label></div><div className="flex flex-col gap-3 border-t border-brand-ink/10 pt-4 sm:flex-row sm:items-center sm:justify-between"><label className="inline-flex items-center gap-2 text-sm font-bold text-brand-ink/70"><input type="checkbox" name="onlyRepeat" value="1" defaultChecked={filters.onlyRepeat} className="h-4 w-4 rounded border-brand-ink/30 accent-brand-pink" />Solo clientes con recompra</label><div className="flex gap-2"><Button type="submit" className="flex-1 sm:flex-none"><Filter className="mr-2 h-4 w-4" />Aplicar</Button><Link href="/admin/marketing" className="flex-1 sm:flex-none"><Button type="button" variant="ghost" className="w-full">Últimos 30 días</Button></Link></div></div></form></Card>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Facturación confirmada" value={formatArs(data.summary.confirmedRevenue)} helper="Todos los canales · sólo pagos confirmados" tone="text-brand-pink" /><MetricCard label="Compras confirmadas" value={data.summary.confirmedOrders.toLocaleString("es-AR")} helper={`${data.summary.uniqueCustomers.toLocaleString("es-AR")} clientes únicos`} /><MetricCard label="Conversión a compra" value={formatPercent(conversionRate)} helper={`${data.summary.sessions.toLocaleString("es-AR")} sesiones en el período`} /><MetricCard label="Recompra" value={formatPercent(data.summary.repeatCustomerRate)} helper={`${formatArs(data.summary.repeatRevenue)} de clientes recurrentes`} /></section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5 md:p-6"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Embudo del período</p><h2 className="mt-1 font-display text-3xl text-brand-ink">Dónde se pierde la intención</h2><p className="mt-2 text-sm leading-6 text-brand-ink/60">Cada etapa mide personas o acciones registradas dentro del período seleccionado.</p><div className="mt-6 space-y-4">{funnel.map((step, index) => { const previous = index === 0 ? step.value : funnel[index - 1].value; const rate = previous ? (step.value / previous) * 100 : 0; return <div key={step.label}><div className="flex items-end justify-between gap-3"><span className="text-sm font-bold text-brand-ink">{step.label}</span><span className="text-lg font-extrabold text-brand-ink">{step.value.toLocaleString("es-AR")}</span></div><div className="mt-2 h-2.5 overflow-hidden rounded-full bg-brand-ink/8"><div className={`h-full rounded-full ${step.tone}`} style={{ width: `${Math.max(step.value ? 8 : 0, (step.value / Math.max(funnel[0].value, 1)) * 100)}%` }} /></div>{index > 0 ? <p className="mt-1 text-xs font-semibold text-brand-ink/45">{formatPercent(rate)} avanza desde la etapa anterior</p> : null}</div>; })}</div></Card>
        <Card className="p-5 md:p-6"><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Canales</p><h2 className="mt-1 font-display text-3xl text-brand-ink">Meta, Google y el resto</h2><p className="mt-2 text-sm leading-6 text-brand-ink/60">Compará volumen, conversión e ingreso antes de cambiar presupuesto.</p><div className="mt-6 space-y-4">{data.categoryPerformance.slice(0, 6).map((row) => <div key={row.key} className="rounded-2xl border border-brand-ink/10 p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-extrabold text-brand-ink">{sourceName(row.key.split(":")[0], row.key.split(":")[1])}</p><p className="mt-1 text-xs font-semibold text-brand-ink/50">{row.sessions.toLocaleString("es-AR")} sesiones · {row.popupLeads + row.cartLeads} capturas</p></div><p className="text-right text-lg font-extrabold text-brand-pink">{formatArs(row.confirmedRevenue)}</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-ink/8"><div className="h-full rounded-full bg-brand-pink" style={{ width: `${Math.max(row.confirmedRevenue ? 7 : 0, (row.confirmedRevenue / maxRevenue) * 100)}%` }} /></div><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><MetricInline label="Compras" value={row.confirmedOrders.toLocaleString("es-AR")} /><MetricInline label="Conversión" value={formatPercent(row.conversionRate)} /><MetricInline label="Recompra" value={row.repeatOrders.toLocaleString("es-AR")} /></div></div>)}{data.categoryPerformance.length === 0 ? <EmptyState copy="No hay sesiones ni ventas para estos filtros." /> : null}</div></Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2"><CampaignPanel title="Campañas que convierten" eyebrow="Para escalar" icon={<ArrowUpRight className="h-5 w-5" />} copy="Prioridad: proteger presupuesto y buscar creatividades o audiencias similares." campaigns={campaignsToScale} intent="scale" empty="Todavía no hay campañas con compras confirmadas en este período." /><CampaignPanel title="Tráfico sin compra" eyebrow="Para revisar" icon={<ArrowDownRight className="h-5 w-5" />} copy="Campañas con al menos 5 sesiones y sin compra atribuida. Revisá anuncio, landing, oferta o medición antes de pausarlas." campaigns={campaignsToReview} intent="review" empty="No hay campañas con volumen suficiente sin compra atribuida." /></section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]"><Card className="p-5 md:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Ventas recientes</p><h2 className="mt-1 font-display text-3xl text-brand-ink">Atribución lista para revisar</h2></div><ShoppingBag className="h-6 w-6 text-brand-ink/30" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{data.recentOrders.slice(0, 6).map((order) => <article key={order.orderNumber} className="rounded-2xl border border-brand-ink/10 p-4"><div className="flex justify-between gap-3"><p className="font-extrabold text-brand-ink">#{order.orderNumber}</p><p className="font-extrabold text-brand-pink">{formatArs(order.totalArs)}</p></div><p className="mt-2 truncate text-sm font-semibold text-brand-ink/70">{order.sourceLabel}{order.campaign ? ` · ${order.campaign}` : ""}</p><p className="mt-2 text-xs text-brand-ink/45">{order.touchpoints} touchpoints · {order.repeatCustomer ? "Recompra" : "Primera compra"}</p></article>)}{!data.recentOrders.length ? <EmptyState copy="No hay pedidos para estos filtros." /> : null}</div></Card><Card className="bg-[#fff7f5] p-5 md:p-6"><MousePointerClick className="h-6 w-6 text-brand-pink" /><p className="mt-4 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Para una agencia</p><h2 className="mt-1 font-display text-3xl text-brand-ink">Qué sí y qué no mide</h2><p className="mt-3 text-sm leading-6 text-brand-ink/65">Esta vista mide sesiones, capturas, ventas e ingresos atribuidos dentro de la web. Para CPA, ROAS y rentabilidad hace falta cruzarla con la inversión real de Meta y Google.</p><p className="mt-4 text-sm font-bold text-brand-ink">Regla operativa: toda pauta debe incluir UTMs de fuente, medio, campaña, conjunto y anuncio.</p></Card></section>

      <details className="rounded-[2rem] border border-brand-ink/10 bg-white p-5 shadow-card md:p-6"><summary className="cursor-pointer list-none font-extrabold text-brand-ink"><span className="mr-2 text-brand-pink">+</span>Ver ranking completo de campañas ({data.campaignPerformance.length})</summary><div className="mt-5 grid gap-3 md:grid-cols-2">{data.campaignPerformance.map((campaign) => <CampaignRow key={campaign.key} campaign={campaign} intent="detail" />)}</div></details>
    </div>
  );
}

function DateField({ label, name, value }: { label: string; name: string; value: string }) { return <label><span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.13em] text-brand-ink/55">{label}</span><input type="date" name={name} defaultValue={value} className="h-11 w-full rounded-xl border border-brand-ink/10 px-3 text-sm" /></label>; }
function MetricCard({ label, value, helper, tone = "text-brand-ink" }: { label: string; value: string; helper: string; tone?: string }) { return <Card className="p-5"><p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink/45">{label}</p><p className={`mt-3 text-3xl font-extrabold ${tone}`}>{value}</p><p className="mt-2 text-sm text-brand-ink/55">{helper}</p></Card>; }
function MetricInline({ label, value }: { label: string; value: string }) { return <div><p className="text-brand-ink/45">{label}</p><p className="mt-0.5 font-extrabold text-brand-ink">{value}</p></div>; }
function CampaignPanel({ title, eyebrow, icon, copy, campaigns, intent, empty }: { title: string; eyebrow: string; icon: ReactNode; copy: string; campaigns: Array<{ key: string; category: string; platform: string; campaign: string; sessions: number; confirmedOrders: number; confirmedRevenue: number; leadsCaptured: number; conversionRate: number }>; intent: "scale" | "review"; empty: string }) { const tone = intent === "scale" ? "text-[#278460] bg-[#43a77b]/12" : "text-[#a97100] bg-[#f5bd53]/18"; return <Card className="p-5 md:p-6"><div className="flex items-start gap-3"><span className={`rounded-2xl p-3 ${tone}`}>{icon}</span><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-ink/50">{eyebrow}</p><h2 className="mt-1 font-display text-3xl text-brand-ink">{title}</h2></div></div><p className="mt-2 text-sm leading-6 text-brand-ink/60">{copy}</p><div className="mt-5 space-y-3">{campaigns.map((campaign) => <CampaignRow key={campaign.key} campaign={campaign} intent={intent} />)}{!campaigns.length ? <EmptyState copy={empty} /> : null}</div></Card>; }
function CampaignRow({ campaign, intent }: { campaign: { key: string; category: string; platform: string; campaign: string; sessions: number; confirmedOrders: number; confirmedRevenue: number; leadsCaptured: number; conversionRate: number }; intent: "scale" | "review" | "detail" }) { const accent = intent === "scale" ? "bg-[#43a77b]" : intent === "review" ? "bg-[#f5bd53]" : "bg-brand-pink"; return <article className="rounded-2xl border border-brand-ink/10 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-extrabold text-brand-ink">{campaign.campaign}</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-ink/45">{campaign.category} · {campaign.platform}</p></div><p className="shrink-0 font-extrabold text-brand-pink">{formatArs(campaign.confirmedRevenue)}</p></div><div className="mt-3 grid grid-cols-4 gap-2 text-xs"><MetricInline label="Sesiones" value={campaign.sessions.toLocaleString("es-AR")} /><MetricInline label="Capturas" value={campaign.leadsCaptured.toLocaleString("es-AR")} /><MetricInline label="Compras" value={campaign.confirmedOrders.toLocaleString("es-AR")} /><MetricInline label="Conv." value={formatPercent(campaign.conversionRate)} /></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-ink/8"><div className={`h-full rounded-full ${accent}`} style={{ width: `${Math.min(100, Math.max(campaign.conversionRate ? 8 : 0, campaign.conversionRate * 12))}%` }} /></div></article>; }
function EmptyState({ copy }: { copy: string }) { return <p className="rounded-2xl bg-brand-ink/5 p-4 text-sm leading-6 text-brand-ink/60">{copy}</p>; }
