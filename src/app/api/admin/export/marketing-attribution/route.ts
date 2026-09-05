import { assertAdminSection } from "@/lib/auth/admin";
import {
  buildMarketingExportRows,
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
  const filters = parseMarketingDashboardFilters(url.searchParams);
  const data = await getMarketingDashboardData(filters);
  const rows = buildMarketingExportRows(data);

  const columns = [
    "Email",
    "Primer ingreso",
    "Ultimo ingreso",
    "Categoria inicial",
    "Plataforma inicial",
    "Canal inicial",
    "Origen inicial",
    "Campana inicial",
    "Contenido inicial",
    "Termino inicial",
    "Referrer inicial",
    "Primer canal pago",
    "Primera campaña paga",
    "Ultimo canal pago",
    "Ultima campaña paga",
    "Campañas asistidas",
    "Plataformas asistidas",
    "Puntos de contacto",
    "Recorrido resumido",
    "Captado en home",
    "Estado de captura",
    "Popup captado",
    "Carrito captado",
    "Primera compra",
    "Ultima compra",
    "Compras confirmadas",
    "Facturacion total",
    "Recompra",
    "Ultimo pedido",
    "Categoria final",
    "Plataforma final",
    "Canal final",
    "Origen final",
    "Campana final",
    "Contenido final",
    "Termino final",
    "Eventos relevantes",
  ];

  const tableRows = rows
    .map((row) => [
      row.email,
      row.firstSeenAt ? formatArgentinaDateTime(row.firstSeenAt) : "",
      row.lastSeenAt ? formatArgentinaDateTime(row.lastSeenAt) : "",
      row.firstCategory,
      row.firstPlatform,
      row.firstChannel,
      row.firstLabel,
      row.firstCampaign,
      row.firstContent,
      row.firstTerm,
      row.firstReferrer,
      row.firstPaidLabel,
      row.firstPaidCampaign,
      row.lastPaidLabel,
      row.lastPaidCampaign,
      row.assistedCampaigns,
      row.assistedPlatforms,
      row.touchpoints,
      row.journeySummary,
      row.popupCapturedHome,
      row.leadStage,
      row.popupCapturedAt ? formatArgentinaDateTime(row.popupCapturedAt) : "",
      row.cartCapturedAt ? formatArgentinaDateTime(row.cartCapturedAt) : "",
      row.firstOrderAt ? formatArgentinaDateTime(row.firstOrderAt) : "",
      row.lastOrderAt ? formatArgentinaDateTime(row.lastOrderAt) : "",
      row.confirmedOrders,
      row.totalRevenue,
      row.repeatCustomer,
      row.lastOrderNumber,
      row.lastCategory,
      row.lastPlatform,
      row.lastChannel,
      row.lastLabel,
      row.lastCampaign,
      row.lastContent,
      row.lastTerm,
      row.timeline,
    ])
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");

  const tableHead = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
      </head>
      <body>
        <table>
          <thead>
            <tr>${tableHead}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>
  `;

  return new Response(`\uFEFF${html}`, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="marketing-attribution-${formatArgentinaDate(new Date()).replace(/\//g, "-")}.xls"`,
    },
  });
}
