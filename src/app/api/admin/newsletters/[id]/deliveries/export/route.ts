import { getAdminNewsletter, getAdminNewsletterDeliveries } from "@/features/newsletter/queries";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError } from "@/lib/http/route";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

type RouteContext = { params: Promise<{ id: string }> };

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  // Prevent spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await assertAdminSection("newsletter");
    const { id } = await context.params;
    const [newsletter, deliveries] = await Promise.all([getAdminNewsletter(id), getAdminNewsletterDeliveries(id)]);
    const header = ["email", "tanda", "estado", "motivo", "error", "enviado", "aperturas", "clicks"];
    const rows = deliveries.map((delivery) =>
      [
        delivery.recipientEmail,
        delivery.wave,
        delivery.status,
        delivery.skipReason,
        delivery.errorMessage,
        delivery.sentAt ? formatArgentinaDateTime(delivery.sentAt) : "",
        delivery.openCount,
        delivery.clickCount,
      ]
        .map(csvCell)
        .join(","),
    );
    const fileName = `newsletter-${newsletter?.slug ?? id}-envios.csv`;

    return new Response(`﻿${[header.map(csvCell).join(","), ...rows].join("\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
