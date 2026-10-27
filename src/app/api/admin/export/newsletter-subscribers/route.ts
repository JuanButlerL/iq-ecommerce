import { NewsletterSubscriberStatus } from "@prisma/client";

import { assertAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { formatArgentinaDate, formatArgentinaDateTime } from "@/lib/utils/datetime";

function escapeHtml(value: string | null | undefined) {
  const rawValue = value ?? "";
  const safeValue = /^[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue;

  return safeValue
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  await assertAdminSection("emails");

  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { status: NewsletterSubscriberStatus.SUBSCRIBED },
    orderBy: { consentedAt: "desc" },
    select: {
      email: true,
      consentSource: true,
      consentVersion: true,
      consentedAt: true,
    },
  });

  const columns = ["Email", "Origen del consentimiento", "Versión del consentimiento", "Fecha de consentimiento"];
  const rows = subscribers.map((subscriber) => [
    subscriber.email,
    subscriber.consentSource === "CHECKOUT" ? "Checkout" : "Popup de bienvenida",
    subscriber.consentVersion,
    formatArgentinaDateTime(subscriber.consentedAt),
  ]);
  const tableHead = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const tableRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
  const html = `<html><head><meta charset="utf-8" /></head><body><table><thead><tr>${tableHead}</tr></thead><tbody>${tableRows}</tbody></table></body></html>`;

  return new Response(`\uFEFF${html}`, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="newsletter-suscriptos-${formatArgentinaDate(new Date()).replace(/\//g, "-")}.xls"`,
    },
  });
}
