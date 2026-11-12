import Link from "next/link";
import { ArrowLeft, Download, Info, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatAdminDateTime } from "@/features/newsletter/components/newsletter-admin-labels";
import { parseResultsRange } from "@/features/newsletter/results-csv";
import { ATTRIBUTION_DAYS, formatRate } from "@/features/newsletter/results";
import { getNewsletterResultsOverview } from "@/features/newsletter/results-queries";
import { requireAdminSection } from "@/lib/auth/admin";
import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";

type PageProps = { searchParams: Promise<{ desde?: string; hasta?: string }> };

function rate(part: number, total: number) {
  return formatRate(total > 0 ? part / total : null);
}

export default async function AdminNewsletterResultsOverviewPage({ searchParams }: PageProps) {
  await requireAdminSection("newsletter");
  const range = parseResultsRange(await searchParams);
  const { results, totals } = await getNewsletterResultsOverview(range);
  const best = results.reduce<(typeof results)[number] | null>((top, item) => (item.summary.revenueArs > (top?.summary.revenueArs ?? 0) ? item : top), null);
  const query = `desde=${range.desde}&hasta=${range.hasta}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/admin/newsletter" className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-pink">
            <ArrowLeft className="h-4 w-4" /> Newsletter
          </Link>
          <h1 className="mt-2 font-display text-3xl text-brand-ink md:text-5xl">Resultados de las newsletters</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/65">Cuánta gente abrió, hizo click y compró con cada newsletter. Entrá a una para ver persona por persona.</p>
        </div>
        <form className="flex flex-wrap items-end gap-2" action="/admin/newsletter/resultados">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-brand-ink/60">Enviadas desde</span>
            <Input type="date" name="desde" defaultValue={range.desde} className="h-10" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-brand-ink/60">hasta</span>
            <Input type="date" name="hasta" defaultValue={range.hasta} className="h-10" />
          </label>
          <Button type="submit" size="sm">Ver</Button>
          <a href={`/api/admin/newsletters/results/export?${query}`} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:bg-white">
            <Download className="h-4 w-4" /> Descargar Excel
          </a>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Newsletters enviadas", value: totals.newsletters.toLocaleString("es-AR"), hint: `${totals.sent.toLocaleString("es-AR")} mails en total` },
          { label: "Aperturas", value: rate(totals.opened, totals.sent), hint: `${totals.opened.toLocaleString("es-AR")} personas-mail abiertas` },
          { label: "Clicks", value: rate(totals.clicked, totals.sent), hint: `${totals.visits.toLocaleString("es-AR")} visitas a la web desde los links` },
          { label: "Compras", value: totals.uniqueOrders.toLocaleString("es-AR"), hint: "Cada pedido contado una sola vez" },
          { label: "Facturación", value: formatArs(totals.uniqueRevenueArs), hint: totals.unsubscribed > 0 ? `${totals.unsubscribed} bajas en el período` : "Sin bajas en el período" },
        ].map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="text-2xl font-extrabold text-brand-ink">{tile.value}</p>
            <p className="text-sm font-bold text-brand-ink/65">{tile.label}</p>
            <p className="mt-1 text-xs text-brand-ink/45">{tile.hint}</p>
          </Card>
        ))}
      </div>

      {best && best.summary.revenueArs > 0 && results.length > 1 ? (
        <Card className="flex items-start gap-3 bg-[linear-gradient(110deg,#fff2f3,#fffdfa)] p-5 ring-1 ring-brand-pink/20">
          <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-brand-pink" />
          <p className="text-sm leading-6 text-brand-ink/70">
            La que más vendió fue <span className="font-bold text-brand-ink">{best.newsletter.title}</span>: {best.summary.orders} {best.summary.orders === 1 ? "pedido" : "pedidos"} por {formatArs(best.summary.revenueArs)}, con {formatRate(best.summary.clickRate)} de clicks.
          </p>
        </Card>
      ) : null}

      <Card className="p-5 md:p-6">
        {results.length === 0 ? (
          <p className="py-8 text-center text-sm text-brand-ink/50">No hay newsletters enviadas en estas fechas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.1em] text-brand-ink/45">
                <tr>
                  <th className="py-2 pr-3">Newsletter</th>
                  <th className="py-2 pr-3 text-right">Enviados</th>
                  <th className="py-2 pr-3 text-right">Abrieron</th>
                  <th className="py-2 pr-3 text-right">Click</th>
                  <th className="py-2 pr-3 text-right">Compraron</th>
                  <th className="py-2 pr-3 text-right">Conversión</th>
                  <th className="py-2 pr-3 text-right">Facturación</th>
                  <th className="py-2 pr-3 text-right">Por mail</th>
                  <th className="py-2 pr-3 text-right">Clientes nuevos</th>
                  <th className="py-2 pr-3">Cupones</th>
                  <th className="py-2 text-right">Bajas</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={item.newsletter.id} className={cn("border-t border-brand-ink/8 align-top", best?.newsletter.id === item.newsletter.id && item.summary.revenueArs > 0 ? "bg-brand-pink/[0.04]" : "")}>
                    <td className="py-3 pr-3">
                      <Link href={`/admin/newsletter/${item.newsletter.id}/resultados`} className="font-bold text-brand-ink underline-offset-4 hover:text-brand-pink hover:underline">
                        {item.newsletter.title}
                      </Link>
                      <p className="text-xs text-brand-ink/50">{formatAdminDateTime(item.newsletter.startedAt)}</p>
                    </td>
                    <td className="py-3 pr-3 text-right">{item.summary.sent.toLocaleString("es-AR")}</td>
                    <td className="py-3 pr-3 text-right">
                      {item.summary.opened} <span className="text-brand-ink/45">({formatRate(item.summary.openRate)})</span>
                    </td>
                    <td className="py-3 pr-3 text-right">
                      {item.summary.clicked} <span className="text-brand-ink/45">({formatRate(item.summary.clickRate)})</span>
                    </td>
                    <td className="py-3 pr-3 text-right font-bold">{item.summary.buyers}</td>
                    <td className="py-3 pr-3 text-right">{formatRate(item.summary.conversionRate)}</td>
                    <td className="py-3 pr-3 text-right font-bold">{formatArs(item.summary.revenueArs)}</td>
                    <td className="py-3 pr-3 text-right">{item.summary.revenuePerEmailArs === null ? "—" : formatArs(item.summary.revenuePerEmailArs)}</td>
                    <td className="py-3 pr-3 text-right">{item.summary.newCustomers}</td>
                    <td className="py-3 pr-3 text-xs text-brand-ink/60">{item.summary.coupons.filter((coupon) => coupon.code !== "Sin cupón").map((coupon) => `${coupon.code} (${coupon.orders})`).join(", ") || "—"}</td>
                    <td className="py-3 text-right">{item.summary.unsubscribed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="bg-brand-ink/[0.02] p-5 text-sm leading-6 text-brand-ink/65 md:p-6">
        <p className="flex items-center gap-2 font-bold text-brand-ink">
          <Info className="h-4 w-4 text-brand-pink" /> Cómo leer esta tabla
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Una compra cuenta para una newsletter si la persona hizo click y compró dentro de los {ATTRIBUTION_DAYS} días, o si compró después de entrar por uno de sus links.</li>
          <li>Conversión: qué parte de los que recibieron el mail terminó comprando. Por mail: facturación dividida por los mails enviados, sirve para comparar newsletters de distinto tamaño.</li>
          <li>Si alguien hizo click en dos newsletters y compró, la compra aparece en las dos filas. Los totales de arriba la cuentan una sola vez.</li>
          <li>Solo pedidos pagos o con comprobante subido, sin cancelados ni vencidos.</li>
        </ul>
      </Card>
    </div>
  );
}
