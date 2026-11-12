"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3, Download, Info, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatAdminDateTime } from "@/features/newsletter/components/newsletter-admin-labels";
import {
  ATTRIBUTION_DAYS,
  formatHours,
  formatRate,
  personStatusMeta,
  viaLabels,
  type NewsletterResults,
  type PersonStatus,
  type Serialized,
} from "@/features/newsletter/results";
import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";

type Filter = "ALL" | PersonStatus;

const filterOrder: PersonStatus[] = ["BOUGHT", "FORWARDED_BUYER", "BOUGHT_AFTER_OPEN", "CLICKED", "OPENED", "NOT_OPENED"];

export function NewsletterResultsDetail({ results }: { results: Serialized<NewsletterResults> }) {
  const { newsletter, summary, people } = results;
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const map = new Map<PersonStatus, number>();
    for (const person of people) map.set(person.status, (map.get(person.status) ?? 0) + 1);
    return map;
  }, [people]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return people.filter((person) => {
      if (filter !== "ALL" && person.status !== filter) return false;
      return !needle || person.email.includes(needle) || (person.name ?? "").toLowerCase().includes(needle);
    });
  }, [people, filter, query]);

  const funnel = [
    { label: "Recibieron el mail", value: summary.sent, rate: null as number | null, hint: "Envíos que salieron bien" },
    { label: "Lo abrieron", value: summary.opened, rate: summary.openRate, hint: "sobre los que lo recibieron" },
    { label: "Hicieron click", value: summary.clicked, rate: summary.clickRate, hint: `${formatRate(summary.clickToOpenRate)} de los que lo abrieron` },
    { label: "Compraron", value: summary.buyers, rate: summary.conversionRate, hint: summary.clicked > 0 ? `${formatRate(summary.clickConversionRate)} de los que hicieron click` : "sobre los que lo recibieron" },
  ];
  const funnelMax = Math.max(summary.sent, summary.buyers, 1);
  const exportHref = (status: Filter) => `/api/admin/newsletters/${newsletter.id}/results/export${status === "ALL" ? "" : `?estado=${status}`}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/admin/newsletter/resultados" className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-pink">
              <ArrowLeft className="h-4 w-4" /> Todas las newsletters
            </Link>
            <Link href={`/admin/newsletter/${newsletter.id}`} className="text-sm font-bold text-brand-ink/55 hover:text-brand-ink">
              Ir al editor
            </Link>
          </div>
          <h1 className="mt-2 font-display text-3xl text-brand-ink md:text-4xl">Resultados</h1>
          <p className="mt-1 text-sm text-brand-ink/65">
            <span className="font-bold text-brand-ink">{newsletter.title}</span> · enviada el {formatAdminDateTime(newsletter.startedAt)}
          </p>
          <p className="text-xs text-brand-ink/45">Asunto: {newsletter.emailSubject}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/newsletter/${newsletter.id}/envios`} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:bg-white">
            <Users className="h-4 w-4" /> Envíos
          </Link>
          <a href={exportHref("ALL")} className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-pink px-4 text-sm font-extrabold text-white shadow-soft hover:bg-[#ea737d]">
            <Download className="h-4 w-4" /> Descargar Excel
          </a>
        </div>
      </div>

      <Card className="p-5 md:p-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Embudo</p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {funnel.map((step) => (
            <div key={step.label} className="rounded-[1.25rem] bg-brand-ink/[0.03] p-4">
              <p className="text-sm font-bold text-brand-ink/65">{step.label}</p>
              <p className="mt-1 text-3xl font-extrabold text-brand-ink">
                {step.value.toLocaleString("es-AR")}
                {step.rate !== null ? <span className="ml-2 text-base font-extrabold text-brand-pink">{formatRate(step.rate)}</span> : null}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-ink/8">
                <div className="h-full rounded-full bg-brand-pink" style={{ width: `${Math.max(2, (step.value / funnelMax) * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs text-brand-ink/45">{step.hint}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Facturación", value: formatArs(summary.revenueArs), hint: `${summary.orders} ${summary.orders === 1 ? "pedido" : "pedidos"}` },
          { label: "Ticket promedio", value: summary.averageTicketArs === null ? "—" : formatArs(summary.averageTicketArs), hint: summary.discountArs > 0 ? `${formatArs(summary.discountArs)} en descuentos de cupón` : "Sin descuentos de cupón" },
          { label: "Ingreso por mail enviado", value: summary.revenuePerEmailArs === null ? "—" : formatArs(summary.revenuePerEmailArs), hint: "Facturación dividida por los mails enviados" },
          { label: "Clientes nuevos", value: summary.newCustomers.toLocaleString("es-AR"), hint: "Pedidos de gente que nunca había comprado" },
          { label: "Tiempo típico hasta comprar", value: formatHours(summary.medianHoursToBuy), hint: "Desde el click hasta el pedido (mediana)" },
          { label: "Visitas a la web", value: summary.visits.toLocaleString("es-AR"), hint: "Entradas por los links de esta newsletter" },
          { label: "Abrieron y compraron sin click", value: summary.boughtAfterOpen.toLocaleString("es-AR"), hint: "Aparte: no se cuentan como venta" },
          { label: "Bajas", value: summary.unsubscribed.toLocaleString("es-AR"), hint: `Se dieron de baja en los ${ATTRIBUTION_DAYS} días siguientes` },
        ].map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="text-2xl font-extrabold text-brand-ink">{tile.value}</p>
            <p className="text-sm font-bold text-brand-ink/65">{tile.label}</p>
            <p className="mt-1 text-xs text-brand-ink/45">{tile.hint}</p>
          </Card>
        ))}
      </div>

      {summary.coupons.length > 0 ? (
        <Card className="p-5 md:p-6">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Cupones en las compras de esta newsletter</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {summary.coupons.map((coupon) => (
              <span key={coupon.code} className="rounded-2xl bg-brand-ink/[0.04] px-4 py-2 text-sm">
                <span className="font-extrabold text-brand-ink">{coupon.code}</span>
                <span className="text-brand-ink/60"> · {coupon.orders} {coupon.orders === 1 ? "pedido" : "pedidos"} · {formatArs(coupon.revenueArs)}</span>
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Persona por persona</p>
            <h2 className="mt-1 font-display text-2xl">Quién abrió, quién hizo click y quién compró</h2>
          </div>
          <label className="relative block lg:w-72">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-ink/35" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar email o nombre" className="pl-10" />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setFilter("ALL")} className={cn("rounded-full px-3.5 py-2 text-xs font-extrabold transition", filter === "ALL" ? "bg-brand-ink text-white" : "bg-brand-ink/5 text-brand-ink/65 hover:bg-brand-ink/10")}>
            Todos · {people.length}
          </button>
          {filterOrder
            .filter((status) => (counts.get(status) ?? 0) > 0)
            .map((status) => (
              <button key={status} type="button" onClick={() => setFilter(status)} className={cn("rounded-full px-3.5 py-2 text-xs font-extrabold transition", filter === status ? "bg-brand-ink text-white" : "bg-brand-ink/5 text-brand-ink/65 hover:bg-brand-ink/10")}>
                {personStatusMeta[status].short} · {counts.get(status)}
              </button>
            ))}
        </div>

        {filter !== "ALL" ? (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-brand-ink/[0.03] px-4 py-3 text-sm text-brand-ink/65 sm:flex-row sm:items-center sm:justify-between">
            <p>{personStatusMeta[filter].description}</p>
            <a href={exportHref(filter)} className="inline-flex shrink-0 items-center gap-2 font-extrabold text-brand-pink hover:underline">
              <Download className="h-4 w-4" /> Descargar esta lista
            </a>
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.1em] text-brand-ink/45">
              <tr>
                <th className="py-2 pr-3">Persona</th>
                <th className="py-2 pr-3">Resultado</th>
                <th className="py-2 pr-3">Abrió</th>
                <th className="py-2 pr-3">Click</th>
                <th className="py-2">Compra</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-brand-ink/45">
                    No hay personas con este filtro.
                  </td>
                </tr>
              ) : (
                visible.map((person) => (
                  <tr key={person.email} className="border-t border-brand-ink/8 align-top">
                    <td className="py-3 pr-3">
                      <p className="font-bold text-brand-ink">{person.email}</p>
                      {person.name ? <p className="text-xs text-brand-ink/50">{person.name}</p> : null}
                      {person.unsubscribed ? <p className="mt-1 text-xs font-bold text-red-600">Se dio de baja</p> : null}
                    </td>
                    <td className="py-3 pr-3">
                      <span className={cn("whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em]", personStatusMeta[person.status].className)}>{personStatusMeta[person.status].label}</span>
                    </td>
                    <td className="py-3 pr-3 text-brand-ink/65">
                      {person.received ? (person.firstOpenedAt ? `${formatAdminDateTime(person.firstOpenedAt)}${person.openCount > 1 ? ` · ${person.openCount} veces` : ""}` : "No") : "No lo recibió"}
                    </td>
                    <td className="py-3 pr-3 text-brand-ink/65">
                      {person.received ? (person.firstClickedAt ? `${formatAdminDateTime(person.firstClickedAt)}${person.clickCount > 1 ? ` · ${person.clickCount} clicks` : ""}` : "No") : "—"}
                    </td>
                    <td className="py-3">
                      {person.orders.length === 0 ? (
                        <span className="text-brand-ink/35">—</span>
                      ) : (
                        <ul className="space-y-1.5">
                          {person.orders.map((order) => (
                            <li key={order.orderNumber}>
                              <Link href={`/admin/pedidos?search=${encodeURIComponent(order.orderNumber)}`} className="font-extrabold text-brand-ink underline-offset-4 hover:underline">
                                #{order.orderNumber}
                              </Link>{" "}
                              <span className="font-bold text-brand-ink">{formatArs(order.totalArs)}</span>
                              <span className="text-brand-ink/55"> · {formatAdminDateTime(order.createdAt)}</span>
                              <p className="text-xs text-brand-ink/50">
                                {order.via.map((via) => viaLabels[via]).join(" y ")}
                                {order.couponCode ? ` · cupón ${order.couponCode}` : ""}
                                {order.newCustomer ? " · cliente nuevo" : " · ya era cliente"}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="bg-brand-ink/[0.02] p-5 text-sm leading-6 text-brand-ink/65 md:p-6">
        <p className="flex items-center gap-2 font-bold text-brand-ink">
          <Info className="h-4 w-4 text-brand-pink" /> Cómo se cuenta una compra
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Cuenta si la persona hizo click en el mail y compró dentro de los {ATTRIBUTION_DAYS} días, aunque haya comprado desde otro dispositivo o haya vuelto por otro lado.
          </li>
          <li>También cuenta si la compra vino de alguien que entró por un link de esta newsletter, aunque no la haya recibido (se la reenviaron o vio la versión web).</li>
          <li>Solo pedidos pagos o con comprobante subido. No cuentan los cancelados ni los vencidos.</li>
          <li>Si una persona hizo click en dos newsletters y compró, la compra aparece en las dos. Por eso no conviene sumar la facturación de varias newsletters a mano: el total sin repetir está en la pantalla general.</li>
          <li>Aperturas son aproximadas: algunos clientes de mail (por ejemplo, Apple Mail) marcan como abierto aunque no lo hayan leído, y otros bloquean el registro.</li>
        </ul>
        <Link href="/admin/newsletter/resultados" className="mt-3 inline-flex items-center gap-2 font-extrabold text-brand-pink hover:underline">
          <BarChart3 className="h-4 w-4" /> Comparar con las otras newsletters
        </Link>
      </Card>
    </div>
  );
}
