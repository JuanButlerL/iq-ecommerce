import { CSV_SEPARATOR, csvCell, parseResultsRange } from "@/features/newsletter/results-csv";
import { getNewsletterResultsOverview } from "@/features/newsletter/results-queries";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError } from "@/lib/http/route";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

const percent = (value: number | null) => (value === null ? "" : `${(Math.round(value * 1000) / 10).toLocaleString("es-AR")}%`);

export async function GET(request: Request) {
  try {
    await assertAdminSection("newsletter");
    const params = new URL(request.url).searchParams;
    const range = parseResultsRange({ desde: params.get("desde"), hasta: params.get("hasta") });
    const { results } = await getNewsletterResultsOverview(range);
    const header = ["newsletter", "asunto", "utm_campaign", "enviada", "enviados", "abrieron", "% apertura", "hicieron click", "% click", "% click sobre abiertos", "visitas a la web", "compraron", "% conversión", "pedidos", "facturación", "ticket promedio", "ingreso por mail", "descuento cupones", "clientes nuevos", "abrieron y compraron sin click", "compras por reenvío", "bajas", "cupones"];
    const rows = results.map(({ newsletter, summary }) =>
      [
        newsletter.title,
        newsletter.emailSubject,
        newsletter.slug,
        formatArgentinaDateTime(newsletter.startedAt),
        summary.sent,
        summary.opened,
        percent(summary.openRate),
        summary.clicked,
        percent(summary.clickRate),
        percent(summary.clickToOpenRate),
        summary.visits,
        summary.buyers,
        percent(summary.conversionRate),
        summary.orders,
        summary.revenueArs,
        summary.averageTicketArs,
        summary.revenuePerEmailArs,
        summary.discountArs,
        summary.newCustomers,
        summary.boughtAfterOpen,
        summary.forwardedBuyers,
        summary.unsubscribed,
        summary.coupons.map((coupon) => `${coupon.code} (${coupon.orders})`).join(", "),
      ]
        .map(csvCell)
        .join(CSV_SEPARATOR),
    );

    return new Response(`﻿${[header.map(csvCell).join(CSV_SEPARATOR), ...rows].join("\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="resultados-newsletters-${range.desde}-a-${range.hasta}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
