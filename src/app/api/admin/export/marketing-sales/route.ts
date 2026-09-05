import { assertAdminSection } from "@/lib/auth/admin";
import {
  buildMarketingSalesExportRows,
  getMarketingDashboardData,
  parseMarketingDashboardFilters,
} from "@/features/marketing/admin-analytics";
import { formatArgentinaDate, formatArgentinaDateTime } from "@/lib/utils/datetime";

function escapeHtml(value: string | number | null | undefined) {
  const rawValue = value == null ? "" : String(value);
  // Prevent user-controlled UTM values from being interpreted as spreadsheet formulas.
  const stringValue = /^[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue;

  return stringValue
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  await assertAdminSection("marketing");

  const url = new URL(request.url);
  const data = await getMarketingDashboardData(parseMarketingDashboardFilters(url.searchParams));
  const rows = buildMarketingSalesExportRows(data);

  const columns = [
    "Pedido",
    "Email",
    "Fecha de pedido",
    "Fecha de pago",
    "Facturación",
    "Medio de pago",
    "Categoría atribuida",
    "Plataforma atribuida",
    "Canal atribuido",
    "Origen atribuido",
    "Campaña atribuida",
    "Primer origen antes de comprar",
    "Primera campaña antes de comprar",
    "Último origen antes de comprar",
    "Última campaña antes de comprar",
    "Primer canal pago",
    "Primera campaña paga",
    "Último canal pago",
    "Última campaña paga",
    "Campañas asistidas",
    "Plataformas asistidas",
    "Puntos de contacto",
    "Recorrido resumido",
    "Captado en home",
    "Captado en carrito",
    "Cliente con recompra",
  ];

  const tableRows = rows
    .map((row) => [
      row.orderNumber,
      row.email,
      formatArgentinaDateTime(row.createdAt),
      row.paidAt ? formatArgentinaDateTime(row.paidAt) : "",
      row.totalArs,
      row.paymentMethod,
      row.attributedCategory,
      row.attributedPlatform,
      row.attributedChannel,
      row.attributedSource,
      row.attributedCampaign,
      row.firstSource,
      row.firstCampaign,
      row.lastSource,
      row.lastCampaign,
      row.firstPaidSource,
      row.firstPaidCampaign,
      row.lastPaidSource,
      row.lastPaidCampaign,
      row.assistedCampaigns,
      row.assistedPlatforms,
      row.touchpoints,
      row.journeySummary,
      row.popupCapturedAt ? formatArgentinaDateTime(row.popupCapturedAt) : "",
      row.cartCapturedAt ? formatArgentinaDateTime(row.cartCapturedAt) : "",
      row.repeatCustomer,
    ])
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  const tableHead = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const html = `
    <html>
      <head><meta charset="utf-8" /></head>
      <body><table><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table></body>
    </html>
  `;

  return new Response(`\uFEFF${html}`, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="marketing-ventas-atribuidas-${formatArgentinaDate(new Date()).replace(/\//g, "-")}.xls"`,
    },
  });
}
