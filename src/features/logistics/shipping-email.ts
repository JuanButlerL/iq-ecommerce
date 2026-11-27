// Mails de envío al cliente. Sin dependencias para poder testearlos.

export type ShippingEmailData = {
  firstName: string;
  orderNumber: string;
  carrierLabel: string;
  isOwnDelivery: boolean;
  deliveryType: "HOME" | "BRANCH";
  trackingNumber: string | null;
  trackingUrl: string | null;
  dispatchDateLabel: string | null;
  deliveryWindowLabel: string | null;
  destination: string;
  orderUrl: string;
  // Resumen del pedido: así este mail es la confirmación completa.
  summary?: {
    items: { name: string; quantity: number; totalArs: number }[];
    discounts?: { label: string; amountArs: number }[];
    shippingArs: number;
    totalArs: number;
  } | null;
};

function ars(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function summaryTable(summary: NonNullable<ShippingEmailData["summary"]>) {
  const cell = "padding:6px 0;font-size:15px;color:#2d2142";
  const lines = summary.items
    .map((item) => `<tr><td style="${cell}">${escapeHtml(item.name)} × ${item.quantity}</td><td style="${cell};text-align:right;white-space:nowrap">${ars(item.totalArs)}</td></tr>`)
    .join("");
  const discounts = (summary.discounts ?? [])
    .filter((discount) => discount.amountArs > 0)
    .map((discount) => `<tr><td style="${cell}">${escapeHtml(discount.label)}</td><td style="${cell};text-align:right;white-space:nowrap;color:#278460">- ${ars(discount.amountArs)}</td></tr>`)
    .join("");
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 6px">${lines}${discounts}
    <tr><td style="${cell}">Envío</td><td style="${cell};text-align:right">${summary.shippingArs > 0 ? ars(summary.shippingArs) : "Gratis"}</td></tr>
    <tr><td style="padding:10px 0 0;font-size:18px;font-weight:800;color:#2d2142;border-top:1px solid #eee">Total</td><td style="padding:10px 0 0;font-size:18px;font-weight:800;color:#2d2142;text-align:right;border-top:1px solid #eee">${ars(summary.totalArs)}</td></tr>
  </table>`;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
    <p style="margin:16px 0 0;text-align:center;font-size:12px;color:#8a8398">IQ Kids · iqkids.com.ar</p>
  </div>
</body></html>`;
}

function row(label: string, value: string) {
  return `<tr><td style="padding:6px 0;color:#6b6478;font-size:14px">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px;font-weight:700;text-align:right">${value}</td></tr>`;
}

export function trackingUrlFor(carrier: "OWN" | "ANDREANI" | "CORREO_AR", trackingNumber: string | null) {
  if (!trackingNumber) return null;
  if (carrier === "ANDREANI") return `https://www.andreani.com/#!/informacionEnvio/${encodeURIComponent(trackingNumber)}`;
  if (carrier === "CORREO_AR") return `https://www.correoargentino.com.ar/formularios/e-commerce?id=${encodeURIComponent(trackingNumber)}`;
  return null;
}

// Mail único de pedido confirmado: la marca y el tono del mail de siempre, con el detalle del pedido y del envío.
export function buildShipmentConfirmedEmail(data: ShippingEmailData) {
  const pink = "#f47f8d";
  const ink = "#2d2142";
  const subject = `${data.firstName}, tu pedido ${data.orderNumber} está confirmado`;
  const tracking = data.trackingNumber
    ? data.trackingUrl
      ? `<a href="${escapeHtml(data.trackingUrl)}" style="color:${pink};font-weight:800">${escapeHtml(data.trackingNumber)}</a>`
      : escapeHtml(data.trackingNumber)
    : "";
  const detailRow = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:rgba(45,33,66,.6);font-size:14px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px;font-weight:700;color:${ink};text-align:right">${value}</td></tr>`;
  const shippingRows = [
    detailRow("Envío", escapeHtml(data.carrierLabel)),
    ...(tracking ? [detailRow(data.isOwnDelivery ? "Número de pedido" : "Número de seguimiento", tracking)] : []),
    ...(data.dispatchDateLabel ? [detailRow("Sale el", escapeHtml(data.dispatchDateLabel))] : []),
    ...(data.deliveryWindowLabel ? [detailRow(data.deliveryType === "BRANCH" ? "Lo retirás" : "Llega", escapeHtml(data.deliveryWindowLabel))] : []),
    detailRow(data.deliveryType === "BRANCH" ? "Retirás en" : "Entregamos en", escapeHtml(data.destination)),
  ].join("");
  const next = data.isOwnDelivery
    ? "Lo entregamos con nuestro reparto. Te avisamos por WhatsApp cuando salga."
    : data.deliveryType === "BRANCH"
      ? "Cuando llegue a la sucursal, el correo te avisa para que lo retires con tu DNI."
      : "Con el número de seguimiento podés ver dónde está tu pedido en todo momento.";
  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;margin:0 8px 8px 0;${primary ? `background:${pink};color:#fff;` : `background:#fff;color:${ink};border:1px solid rgba(45,33,66,.15);`}text-decoration:none;border-radius:999px;padding:14px 22px;font-weight:800;font-size:15px">${escapeHtml(label)}</a>`;

  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:#fff7f0;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff7f0;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:28px;overflow:hidden;border:1px solid rgba(45,33,66,.10)">
        <tr><td style="background:${pink};padding:22px 28px;color:#fff;font-size:24px;font-weight:800">IQ Kids</td></tr>
        <tr><td style="padding:32px 28px 30px">
          <h1 style="margin:0 0 14px;color:${ink};font-size:28px;line-height:1.15">${escapeHtml(data.firstName)}, tu pedido está confirmado</h1>
          <p style="margin:0 0 22px;color:${ink};font-size:16px;line-height:1.6">Hola ${escapeHtml(data.firstName)}, tu pedido <b>N° ${escapeHtml(data.orderNumber)}</b> ya está confirmado y estamos empezando a prepararlo.</p>
          ${data.summary ? summaryTable(data.summary) : ""}
          <div style="margin:22px 0 18px;background:#fff7f8;border-radius:20px;padding:16px 18px">
            <p style="margin:0 0 6px;color:${pink};font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase">Tu envío</p>
            <table role="presentation" style="width:100%;border-collapse:collapse">${shippingRows}</table>
          </div>
          <p style="margin:0 0 20px;color:${ink};font-size:15px;line-height:1.6">${escapeHtml(next)}</p>
          <div>${data.trackingUrl ? button(data.trackingUrl, "Seguir mi envío", true) : ""}${button(data.orderUrl, "Ver mi pedido", !data.trackingUrl)}</div>
          <p style="margin:24px 0 0;color:${ink};font-size:16px;font-weight:700">¡Gracias por elegir iQ Kids!</p>
          <p style="margin:6px 0 0;color:rgba(45,33,66,.55);font-size:12px;line-height:1.5">Snacks simples y naturales para todos los días.</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;color:rgba(45,33,66,.45);font-size:11px">iqkids.com.ar</p>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Hola ${data.firstName}, tu pedido N° ${data.orderNumber} ya está confirmado y estamos empezando a prepararlo.`,
    "",
    ...(data.summary
      ? [
          ...data.summary.items.map((item) => `${item.name} × ${item.quantity}: ${ars(item.totalArs)}`),
          ...(data.summary.discounts ?? []).filter((d) => d.amountArs > 0).map((d) => `${d.label}: -${ars(d.amountArs)}`),
          `Envío: ${data.summary.shippingArs > 0 ? ars(data.summary.shippingArs) : "Gratis"}`,
          `Total: ${ars(data.summary.totalArs)}`,
          "",
        ]
      : []),
    `Envío: ${data.carrierLabel}`,
    data.trackingNumber ? `${data.isOwnDelivery ? "Número de pedido" : "Número de seguimiento"}: ${data.trackingNumber}` : null,
    data.trackingUrl ? `Seguí tu envío: ${data.trackingUrl}` : null,
    data.dispatchDateLabel ? `Despachamos el ${data.dispatchDateLabel}` : null,
    data.deliveryWindowLabel ? `${data.deliveryType === "BRANCH" ? "Lo retirás" : "Llega"} ${data.deliveryWindowLabel}` : null,
    `${data.deliveryType === "BRANCH" ? "Retirás en" : "Entregamos en"}: ${data.destination}`,
    "",
    next,
    `Tu pedido: ${data.orderUrl}`,
    "",
    "¡Gracias por elegir iQ Kids!",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { subject, html, text };
}

export function buildProofRejectedEmail(data: { firstName: string; orderNumber: string; reason: string | null; uploadUrl: string }) {
  const subject = `Necesitamos que vuelvas a subir el comprobante del pedido ${data.orderNumber}`;
  const reason = data.reason?.trim();
  const html = layout(
    "Comprobante",
    `Hola ${data.firstName}, no pudimos validar tu comprobante`,
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">Revisamos el comprobante de tu pedido <strong>${escapeHtml(data.orderNumber)}</strong> y no pudimos confirmarlo.</p>
     ${reason ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.5"><strong>Motivo:</strong> ${escapeHtml(reason)}</p>` : ""}
     <p style="margin:0 0 16px;font-size:15px;line-height:1.5">Podés subirlo de nuevo desde este link. Si ya transferiste, mandanos el comprobante correcto y lo revisamos enseguida.</p>
     <p style="margin:0"><a href="${escapeHtml(data.uploadUrl)}" style="display:inline-block;background:#F48991;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">Subir comprobante</a></p>`,
  );
  const text = [
    `Hola ${data.firstName}, no pudimos validar el comprobante de tu pedido ${data.orderNumber}.`,
    reason ? `Motivo: ${reason}` : null,
    `Subilo de nuevo acá: ${data.uploadUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, html, text };
}
