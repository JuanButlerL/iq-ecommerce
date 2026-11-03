// Mails de un registro mayorista: bienvenida a la persona y aviso interno. Sin dependencias para poder testearlo.

export type WholesaleRegistrationEmailData = {
  contactName: string;
  email: string;
  phone: string;
  businessName: string | null;
  legalName: string | null;
  businessType: string | null;
  cuit: string;
  taxConditionLabel: string;
  address: string;
  reference: string | null;
  monthlyVolume: string | null;
  message: string | null;
  createdAt: Date;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(value);
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

function detailsTable(rows: [string, string][]) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
    ${rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:9px 12px 9px 0;border-bottom:1px solid #f1e6e8;font-weight:700;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:9px 0;border-bottom:1px solid #f1e6e8;white-space:pre-line">${escapeHtml(value)}</td></tr>`,
      )
      .join("")}
  </table>`;
}

function button(href: string, label: string, background = "#F48991") {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${background};color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;margin:0 8px 8px 0">${escapeHtml(label)}</a>`;
}

export function buildWholesaleRegistrationCustomerEmail(
  registration: WholesaleRegistrationEmailData,
  options: { shopUrl: string; minDisplays: number; paymentMethods: string[]; whatsappUrl: string },
) {
  const firstName = registration.contactName.trim().split(/\s+/)[0] || registration.contactName;
  const subject = "¡Bienvenido a iQ Kids Mayoristas!";
  const paymentMethods = options.paymentMethods.length > 1
    ? `${options.paymentMethods.slice(0, -1).join(", ")} o ${options.paymentMethods[options.paymentMethods.length - 1]}`
    : options.paymentMethods[0];
  const steps = [
    `Elegí los sabores en la tienda mayorista: el pedido mínimo es de ${options.minDisplays} displays y podés combinarlos.`,
    paymentMethods ? `Pagás con ${paymentMethods}.` : null,
    "Te lo enviamos a la dirección que cargaste. Si comprás desde otro dispositivo, solo te pedimos tu email y CUIT.",
  ].filter((step): step is string => Boolean(step));
  const html = layout(
    "iQ Kids Mayoristas",
    `¡Gracias por registrarte, ${firstName}!`,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Ya tenés tu cuenta mayorista para ${escapeHtml(registration.businessName || registration.legalName || "tu negocio")}. Desde ahora podés hacer tu pedido cuando quieras:</p>
      <ol style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.7">
        ${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ol>
      <p style="margin:0">${button(options.shopUrl, "Hacer mi pedido")}${button(options.whatsappUrl, "Escribinos por WhatsApp", "#25D366")}</p>
      <p style="margin:16px 0 0;font-size:12px;color:#8a8196">Registraste el CUIT ${escapeHtml(registration.cuit)}. Si algún dato está mal, respondé este email y lo corregimos.</p>`,
  );
  const text = [
    `¡Gracias por registrarte, ${firstName}!`,
    "",
    "Ya tenés tu cuenta mayorista. Desde ahora podés hacer tu pedido cuando quieras:",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    `Hacer mi pedido: ${options.shopUrl}`,
    `WhatsApp: ${options.whatsappUrl}`,
  ].join("\n");

  return { subject, html, text };
}

export function buildWholesaleRegistrationAdminEmail(registration: WholesaleRegistrationEmailData, options: { adminUrl: string; whatsappUrl: string }) {
  const rows: [string, string | null][] = [
    ["Contacto", registration.contactName],
    ["Negocio", registration.businessName],
    ["Razón social", registration.legalName],
    ["Tipo de negocio", registration.businessType],
    ["CUIT", registration.cuit],
    ["Condición IVA", registration.taxConditionLabel],
    ["Teléfono / WhatsApp", registration.phone],
    ["Email", registration.email],
    ["Dirección de entrega", registration.address],
    ["Referencia", registration.reference],
    ["Cantidad estimada", registration.monthlyVolume],
    ["Mensaje", registration.message],
    ["Fecha", formatDate(registration.createdAt)],
  ];
  const filled = rows.filter((row): row is [string, string] => Boolean(row[1]));
  const subject = `Nuevo cliente mayorista: ${registration.businessName || registration.legalName || registration.contactName}${registration.businessType ? ` (${registration.businessType})` : ""}`;
  const html = layout(
    "Mayoristas",
    "Se registró un cliente mayorista nuevo",
    `${detailsTable(filled)}
      <p style="margin:20px 0 0;font-size:14px;line-height:1.6">Ya está en el maestro de clientes y puede comprar con pago anticipado. Para habilitarle pago posterior a la entrega o un descuento especial, editá su ficha.</p>
      <p style="margin:20px 0 0">${button(options.whatsappUrl, "Escribirle por WhatsApp", "#25D366")}${button(options.adminUrl, "Ver ficha en el admin")}</p>
      <p style="margin:8px 0 0;font-size:12px;color:#8a8196">Si respondés este email, la respuesta le llega directo a ${escapeHtml(registration.email)}.</p>`,
  );
  const text = [
    "Se registró un cliente mayorista nuevo",
    "",
    ...filled.map(([label, value]) => `${label}: ${value}`),
    "",
    "Para habilitarle pago posterior a la entrega o un descuento especial, editá su ficha.",
    `WhatsApp: ${options.whatsappUrl}`,
    `Admin: ${options.adminUrl}`,
  ].join("\n");

  return { subject, html, text };
}
