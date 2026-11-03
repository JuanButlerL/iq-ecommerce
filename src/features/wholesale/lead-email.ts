// Email interno que avisa de una consulta mayorista nueva. Sin dependencias para poder testearlo.

export type WholesaleLeadEmailData = {
  name: string;
  phone: string;
  email: string;
  businessName: string | null;
  businessType: string;
  cuit: string | null;
  street: string;
  floor: string | null;
  city: string;
  province: string;
  postalCode: string;
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

export function buildWholesaleLeadEmail(lead: WholesaleLeadEmailData, options: { adminUrl: string; whatsappUrl: string }) {
  const address = [lead.street, lead.floor, lead.city, lead.province, lead.postalCode ? `CP ${lead.postalCode}` : null].filter(Boolean).join(", ");
  const rows: [string, string | null][] = [
    ["Nombre", lead.name],
    ["Negocio", lead.businessName],
    ["Tipo de negocio", lead.businessType],
    ["Teléfono / WhatsApp", lead.phone],
    ["Email", lead.email],
    ["CUIT", lead.cuit],
    ["Dirección de entrega", address],
    ["Referencia", lead.reference],
    ["Cantidad estimada", lead.monthlyVolume],
    ["Mensaje", lead.message],
    ["Fecha", formatDate(lead.createdAt)],
  ];
  const filled = rows.filter((row): row is [string, string] => Boolean(row[1]));
  const subject = `Nueva consulta mayorista: ${lead.businessName || lead.name} (${lead.businessType})`;

  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#fff6f7;font-family:Arial,Helvetica,sans-serif;color:#2c2241">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <div style="background:#ffffff;border-radius:20px;padding:28px">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#F48991">Mayoristas</p>
      <h1 style="margin:8px 0 20px;font-size:22px;line-height:1.25">Llegó una consulta nueva desde iqkids.com.ar/mayoristas</h1>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">
        ${filled
          .map(
            ([label, value]) =>
              `<tr><td style="padding:9px 12px 9px 0;border-bottom:1px solid #f1e6e8;font-weight:700;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:9px 0;border-bottom:1px solid #f1e6e8;white-space:pre-line">${escapeHtml(value)}</td></tr>`,
          )
          .join("")}
      </table>
      <p style="margin:24px 0 0">
        <a href="${escapeHtml(options.whatsappUrl)}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;margin:0 8px 8px 0">Escribirle por WhatsApp</a>
        <a href="${escapeHtml(options.adminUrl)}" style="display:inline-block;background:#F48991;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;margin:0 0 8px">Ver en el admin</a>
      </p>
      <p style="margin:16px 0 0;font-size:12px;color:#8a8196">Si respondés este email, la respuesta le llega directo a ${escapeHtml(lead.email)}.</p>
    </div>
  </div>
</body></html>`;

  const text = [
    "Llegó una consulta nueva desde iqkids.com.ar/mayoristas",
    "",
    ...filled.map(([label, value]) => `${label}: ${value}`),
    "",
    `WhatsApp: ${options.whatsappUrl}`,
    `Admin: ${options.adminUrl}`,
  ].join("\n");

  return { subject, html, text };
}

// Lleva un teléfono argentino escrito a mano ("011 15 2345-6789", "11 2345 6789") al formato de wa.me (549 + área + número).
export function toArgentineWhatsappNumber(phone: string) {
  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("54")) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("9")) {
    digits = digits.slice(1);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  // "15" después del código de área (2 a 4 dígitos) cuando sobran dígitos: 11 15 2345 6789 → 11 2345 6789.
  if (digits.length === 12) {
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === "15") {
        digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
        break;
      }
    }
  }

  return digits.length === 10 ? `549${digits}` : phone.replace(/\D/g, "");
}
