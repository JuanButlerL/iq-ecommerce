// Mails de un pedido mayorista nuevo: confirmación al cliente y aviso interno. Sin dependencias para poder testearlo.

import { WHOLESALE_PAYMENT_METHOD_LABELS, type WholesalePaymentMethod } from "@/features/wholesale/pricing";

export type WholesaleOrderEmailData = {
  orderNumber: string;
  createdAt: Date;
  contactName: string;
  email: string;
  phone: string;
  cuit: string;
  businessName: string | null;
  taxConditionLabel: string;
  invoiceType: string | null;
  address: string;
  reference: string | null;
  notes: string | null;
  paymentMethod: WholesalePaymentMethod;
  items: { name: string; quantity: number; unitPriceArs: number; lineTotalArs: number }[];
  subtotalArs: number;
  extraDiscountArs: number;
  extraDiscountPercentage: number;
  transferDiscountArs: number;
  shippingArs: number;
  totalArs: number;
  isNewCustomer: boolean;
  deliveryAddressChanged: boolean;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatArs(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(value);
}

function totalsRows(order: WholesaleOrderEmailData): [string, string][] {
  return [
    ["Subtotal", formatArs(order.subtotalArs)],
    ...(order.extraDiscountArs > 0 ? ([[`Descuento especial (${order.extraDiscountPercentage}%)`, `-${formatArs(order.extraDiscountArs)}`]] as [string, string][]) : []),
    ...(order.transferDiscountArs > 0 ? ([["Descuento por transferencia", `-${formatArs(order.transferDiscountArs)}`]] as [string, string][]) : []),
    ["Envío", order.shippingArs > 0 ? formatArs(order.shippingArs) : "Sin cargo"],
    ["Total", formatArs(order.totalArs)],
  ];
}

function layout(eyebrow: string, title: string, body: string) {
  return `<!doctype html>
<html lang="es"><body style="margin:0;background:#fff6f7;font-family:Arial,Helvetica,sans-serif;color:#2c2241">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <div style="background:#ffffff;border-radius:20px;padding:28px">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#F48991">${escapeHtml(eyebrow)}</p>
      <h1 style="margin:8px 0 20px;font-size:22px;line-height:1.25">${escapeHtml(title)}</h1>
      ${body}
    </div>
  </div>
</body></html>`;
}

function itemsTable(order: WholesaleOrderEmailData) {
  const cell = "padding:8px 0;border-bottom:1px solid #f1e6e8";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
    ${order.items
      .map(
        (item) =>
          `<tr><td style="${cell}">${escapeHtml(item.name)} × ${item.quantity}</td><td style="${cell};text-align:right;white-space:nowrap">${formatArs(item.lineTotalArs)}</td></tr>`,
      )
      .join("")}
    ${totalsRows(order)
      .map(
        ([label, value], index, rows) =>
          `<tr><td style="padding:6px 0;${index === rows.length - 1 ? "font-weight:700;font-size:16px" : "color:#5c5470"}">${escapeHtml(label)}</td><td style="padding:6px 0;text-align:right;white-space:nowrap;${index === rows.length - 1 ? "font-weight:700;font-size:16px" : ""}">${escapeHtml(value)}</td></tr>`,
      )
      .join("")}
  </table>`;
}

function detailsTable(rows: [string, string | null][]) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;margin-top:20px">
    ${rows
      .filter((row): row is [string, string] => Boolean(row[1]))
      .map(
        ([label, value]) =>
          `<tr><td style="padding:8px 12px 8px 0;border-bottom:1px solid #f1e6e8;font-weight:700;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:8px 0;border-bottom:1px solid #f1e6e8;white-space:pre-line">${escapeHtml(value)}</td></tr>`,
      )
      .join("")}
  </table>`;
}

function button(href: string, label: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#F48991;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${escapeHtml(label)}</a>`;
}

const PAYMENT_NEXT_STEP: Record<WholesalePaymentMethod, string> = {
  MERCADO_PAGO: "Si todavía no terminaste el pago en Mercado Pago, lo podés retomar desde el link de abajo.",
  BANK_TRANSFER: "Hacé la transferencia por el total y subí el comprobante desde el link de abajo. Despachamos cuando se acredita.",
  ECHEQ: "Emití el eCheq por el total y subí el comprobante desde el link de abajo. Despachamos cuando lo recibimos.",
  DEFERRED: "Lo pagás después de recibirlo, según las condiciones acordadas. Te escribimos para coordinar la entrega.",
};

export function buildWholesaleOrderCustomerEmail(order: WholesaleOrderEmailData, options: { orderUrl: string }) {
  const subject = `Recibimos tu pedido mayorista ${order.orderNumber}`;
  const html = layout(
    "iQ Kids Mayoristas",
    `¡Gracias, ${order.contactName}! Recibimos tu pedido ${order.orderNumber}.`,
    `${itemsTable(order)}
      <p style="margin:20px 0 0;font-size:14px;line-height:1.6"><strong>Pago: ${escapeHtml(WHOLESALE_PAYMENT_METHOD_LABELS[order.paymentMethod])}.</strong> ${escapeHtml(PAYMENT_NEXT_STEP[order.paymentMethod])}</p>
      ${detailsTable([
        ["Entrega", order.address],
        ["Referencia", order.reference],
        ["CUIT", order.cuit],
        ["Condición IVA", order.taxConditionLabel],
        ["Comentarios", order.notes],
      ])}
      <p style="margin:24px 0 0">${button(options.orderUrl, "Ver mi pedido")}</p>
      <p style="margin:16px 0 0;font-size:12px;color:#8a8196">Si tenés alguna duda, respondé este email.</p>`,
  );
  const text = [
    `¡Gracias, ${order.contactName}! Recibimos tu pedido ${order.orderNumber}.`,
    "",
    ...order.items.map((item) => `${item.name} × ${item.quantity}: ${formatArs(item.lineTotalArs)}`),
    ...totalsRows(order).map(([label, value]) => `${label}: ${value}`),
    "",
    `Pago: ${WHOLESALE_PAYMENT_METHOD_LABELS[order.paymentMethod]}. ${PAYMENT_NEXT_STEP[order.paymentMethod]}`,
    `Entrega: ${order.address}`,
    "",
    `Ver mi pedido: ${options.orderUrl}`,
  ].join("\n");

  return { subject, html, text };
}

export function buildWholesaleOrderAdminEmail(order: WholesaleOrderEmailData, options: { adminUrl: string }) {
  const flags = [
    order.isNewCustomer ? "Cliente nuevo (se dio de alta en este pedido)." : null,
    order.deliveryAddressChanged ? "Atención: la dirección de entrega es distinta a la del maestro de clientes." : null,
  ].filter((flag): flag is string => Boolean(flag));
  const subject = `Pedido mayorista ${order.orderNumber}: ${order.businessName || order.contactName} · ${formatArs(order.totalArs)}`;
  const html = layout(
    "Mayoristas",
    `Nuevo pedido mayorista ${order.orderNumber}`,
    `${flags.map((flag) => `<p style="margin:0 0 12px;padding:10px 14px;border-radius:12px;background:#fff6f7;font-size:14px;font-weight:700">${escapeHtml(flag)}</p>`).join("")}
      ${itemsTable(order)}
      ${detailsTable([
        ["Pago", WHOLESALE_PAYMENT_METHOD_LABELS[order.paymentMethod]],
        ["Negocio", order.businessName],
        ["Contacto", order.contactName],
        ["Email", order.email],
        ["Teléfono", order.phone],
        ["CUIT", order.cuit],
        ["Condición IVA", `${order.taxConditionLabel}${order.invoiceType ? ` (factura ${order.invoiceType})` : ""}`],
        ["Entrega", order.address],
        ["Referencia", order.reference],
        ["Comentarios", order.notes],
        ["Fecha", formatDate(order.createdAt)],
      ])}
      <p style="margin:24px 0 0">${button(options.adminUrl, "Ver en el admin")}</p>`,
  );
  const text = [
    `Nuevo pedido mayorista ${order.orderNumber}`,
    ...flags,
    "",
    ...order.items.map((item) => `${item.name} × ${item.quantity}: ${formatArs(item.lineTotalArs)}`),
    ...totalsRows(order).map(([label, value]) => `${label}: ${value}`),
    "",
    `Pago: ${WHOLESALE_PAYMENT_METHOD_LABELS[order.paymentMethod]}`,
    `Cliente: ${order.businessName || order.contactName} · CUIT ${order.cuit} · ${order.email} · ${order.phone}`,
    `Entrega: ${order.address}`,
    `Admin: ${options.adminUrl}`,
  ].join("\n");

  return { subject, html, text };
}
