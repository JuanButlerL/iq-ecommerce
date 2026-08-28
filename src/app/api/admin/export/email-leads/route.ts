import { EmailAutomationTrigger, EmailSendStatus } from "@prisma/client";

import { assertAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { formatArgentinaDate, formatArgentinaDateTime } from "@/lib/utils/datetime";

const leadStatusLabels: Record<string, string> = {
  WELCOME_CAPTURED: "Email captado en home",
  CAPTURED: "Carrito captado",
  CHECKOUT_STARTED: "Checkout iniciado",
  CONVERTED: "Compra realizada",
};

const triggerLabels: Record<EmailAutomationTrigger, string> = {
  WELCOME_LEAD: "Bienvenida temprana",
  CART_ABANDONED: "Recuperacion sin compra",
  ORDER_CREATED: "Pedido recibido",
  POST_PURCHASE: "Post compra",
};

const emailStatusLabels: Record<EmailSendStatus, string> = {
  SENT: "Enviado",
  SKIPPED: "Omitido",
  ERROR: "Error",
};

function escapeHtml(value: string | number | null | undefined) {
  const stringValue = value == null ? "" : String(value);

  return stringValue
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getLeadLifecycleLabel(status: string) {
  return leadStatusLabels[status] ?? status;
}

export async function GET() {
  await assertAdminSection("emails");

  const leads = await prisma.cartRecoveryLead.findMany({
    orderBy: [{ createdAt: "desc" }, { updatedAt: "desc" }],
    include: {
      emailLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          automation: {
            select: { name: true },
          },
        },
      },
    },
  });

  const columns = [
    "Email",
    "Estado operativo",
    "Fecha de alta",
    "Ultima actualizacion",
    "Inicio checkout",
    "Pedido checkout",
    "Fecha conversion",
    "Pedido convertido",
    "Subtotal carrito",
    "Moneda",
    "Provincia",
    "Trigger ultimo email",
    "Estado ultimo email",
    "Automatizacion ultimo email",
    "Asunto ultimo email",
    "Fecha ultimo email/log",
    "Clicks ultimo email",
    "Venta atribuida ultimo email",
  ];

  const rows = leads.map((lead) => {
    const latestLog = lead.emailLogs[0] ?? null;

    return [
      lead.email,
      getLeadLifecycleLabel(lead.status),
      formatArgentinaDateTime(lead.createdAt),
      formatArgentinaDateTime(lead.updatedAt),
      lead.checkoutStartedAt ? formatArgentinaDateTime(lead.checkoutStartedAt) : "",
      lead.checkoutOrderNumber ?? "",
      lead.convertedAt ? formatArgentinaDateTime(lead.convertedAt) : "",
      lead.convertedOrderNumber ?? "",
      lead.subtotalArs,
      lead.currency,
      lead.province ?? "",
      latestLog ? triggerLabels[latestLog.trigger] : "",
      latestLog ? emailStatusLabels[latestLog.status] : "",
      latestLog?.automation.name ?? "",
      latestLog?.subject ?? "",
      latestLog ? formatArgentinaDateTime(latestLog.sentAt ?? latestLog.createdAt) : "",
      latestLog?.clickCount ?? "",
      latestLog?.convertedOrderNumber ?? "",
    ];
  });

  const tableHead = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const tableRows = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join("")}</tr>`,
    )
    .join("");

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
      "Content-Disposition": `attachment; filename="mails-crm-${formatArgentinaDate(new Date()).replace(/\//g, "-")}.xls"`,
    },
  });
}
