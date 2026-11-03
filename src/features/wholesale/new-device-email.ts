// Aviso al cliente mayorista cuando su cuenta se usa desde un navegador nuevo. Sin dependencias para poder testearlo.

export type WholesaleNewDeviceEmailData = {
  contactName: string;
  businessName: string | null;
  cuit: string;
  device: string;
  createdAt: Date;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Argentina/Buenos_Aires" }).format(value);
}

// "Chrome en Android", "Safari en iPhone"... Suficiente para que el cliente reconozca si fue él.
export function describeUserAgent(userAgent: string | null) {
  if (!userAgent) return "un navegador desconocido";

  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\/|Opera/.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /SamsungBrowser\//.test(userAgent)
          ? "Samsung Internet"
          : /Chrome\/|CriOS\//.test(userAgent)
            ? "Chrome"
            : /Safari\//.test(userAgent)
              ? "Safari"
              : null;
  const system = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(userAgent)
            ? "Mac"
            : /Linux/.test(userAgent)
              ? "Linux"
              : null;

  if (browser && system) return `${browser} en ${system}`;
  return browser ?? system ?? "un navegador desconocido";
}

export function buildWholesaleNewDeviceEmail(data: WholesaleNewDeviceEmailData, options: { whatsappUrl: string }) {
  const firstName = data.contactName.trim().split(/\s+/)[0] || data.contactName;
  const account = data.businessName ? `${data.businessName} (CUIT ${data.cuit})` : `CUIT ${data.cuit}`;
  const subject = "Ingresaron a tu cuenta mayorista desde otro dispositivo";
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;background:#fff6f7;font-family:Arial,Helvetica,sans-serif;color:#2c2241">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <div style="background:#ffffff;border-radius:20px;padding:28px">
      <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#F48991">iQ Kids Mayoristas</p>
      <h1 style="margin:8px 0 20px;font-size:22px;line-height:1.25">Hola, ${escapeHtml(firstName)}: ingresaron a tu cuenta desde otro dispositivo</h1>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Se usó tu email y CUIT para entrar a la tienda mayorista con la cuenta de ${escapeHtml(account)}.</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5c5470">${escapeHtml(formatDate(data.createdAt))} · ${escapeHtml(data.device)}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Si fuiste vos, no tenés que hacer nada. <strong>Si no fuiste vos</strong>, respondé este email o escribinos por WhatsApp y lo revisamos.</p>
      <p style="margin:0"><a href="${escapeHtml(options.whatsappUrl)}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">Escribinos por WhatsApp</a></p>
    </div>
  </div>
</body></html>`;
  const text = [
    `Hola, ${firstName}: ingresaron a tu cuenta desde otro dispositivo.`,
    "",
    `Se usó tu email y CUIT para entrar a la tienda mayorista con la cuenta de ${account}.`,
    `${formatDate(data.createdAt)} · ${data.device}`,
    "",
    "Si fuiste vos, no tenés que hacer nada. Si no fuiste vos, respondé este email o escribinos por WhatsApp y lo revisamos.",
    `WhatsApp: ${options.whatsappUrl}`,
  ].join("\n");

  return { subject, html, text };
}
