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
};

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

export function buildShipmentConfirmedEmail(data: ShippingEmailData) {
  const subject = `Tu pedido ${data.orderNumber} está confirmado`;
  const tracking = data.trackingNumber
    ? data.trackingUrl
      ? `<a href="${escapeHtml(data.trackingUrl)}" style="color:#F48991">${escapeHtml(data.trackingNumber)}</a>`
      : escapeHtml(data.trackingNumber)
    : "";
  const rows = [
    row("Envío", escapeHtml(data.carrierLabel)),
    ...(tracking ? [row(data.isOwnDelivery ? "Número de pedido" : "Número de seguimiento", tracking)] : []),
    ...(data.dispatchDateLabel ? [row("Despachamos el", escapeHtml(data.dispatchDateLabel))] : []),
    ...(data.deliveryWindowLabel ? [row("Llega", escapeHtml(data.deliveryWindowLabel))] : []),
    row(data.deliveryType === "BRANCH" ? "Retirás en" : "Entregamos en", escapeHtml(data.destination)),
  ].join("");
  const intro = data.isOwnDelivery
    ? "Lo entregamos con nuestro reparto. Te avisamos por WhatsApp cuando salga."
    : data.deliveryType === "BRANCH"
      ? "Cuando llegue a la sucursal, el transportista te avisa para que lo retires con tu DNI."
      : "Con el número de seguimiento podés ver dónde está tu pedido.";

  const html = layout(
    "Pedido confirmado",
    `¡Gracias, ${data.firstName}! Ya preparamos tu pedido`,
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${escapeHtml(intro)}</p>
     <table style="width:100%;border-collapse:collapse">${rows}</table>
     <p style="margin:24px 0 0">${
       data.trackingUrl
         ? `<a href="${escapeHtml(data.trackingUrl)}" style="display:inline-block;background:#F48991;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;margin:0 8px 8px 0">Seguir mi envío</a>`
         : ""
     }<a href="${escapeHtml(data.orderUrl)}" style="display:inline-block;${
       data.trackingUrl ? "background:#ffffff;color:#2c2241;border:1px solid #e6e1ea;" : "background:#F48991;color:#ffffff;"
     }text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">Ver mi pedido</a></p>`,
  );

  const text = [
    `¡Gracias, ${data.firstName}! Tu pedido ${data.orderNumber} está confirmado.`,
    intro,
    `Envío: ${data.carrierLabel}`,
    data.trackingNumber ? `${data.isOwnDelivery ? "Número de pedido" : "Número de seguimiento"}: ${data.trackingNumber}` : null,
    data.trackingUrl ? `Seguimiento: ${data.trackingUrl}` : null,
    data.dispatchDateLabel ? `Despachamos el ${data.dispatchDateLabel}` : null,
    data.deliveryWindowLabel ? `Llega ${data.deliveryWindowLabel}` : null,
    `${data.deliveryType === "BRANCH" ? "Retirás en" : "Entregamos en"}: ${data.destination}`,
    `Tu pedido: ${data.orderUrl}`,
  ]
    .filter(Boolean)
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
