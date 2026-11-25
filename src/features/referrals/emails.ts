import { formatArs } from "@/lib/utils/currency";
import { formatArgentinaDate } from "@/lib/utils/datetime";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);
}

function layout(title: string, bodyHtml: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#fff7f2;font-family:Arial,Helvetica,sans-serif;color:#2b2233">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:24px;padding:28px">
<tr><td>
<p style="margin:0 0 4px;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#f0848e">Club de Familias iQ</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.2">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#8a8090">IQ Kids · iqkids.com.ar</p>
</td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#f0848e;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:999px">${escapeHtml(label)}</a></p>`;
}

export function buildReferralLoginEmail(input: { firstName: string | null; url: string; minutes: number }) {
  const greeting = input.firstName ? `¡Hola ${input.firstName}!` : "¡Hola!";
  const subject = "Tu acceso al Club de Familias iQ";
  const html = layout(
    "Entrá a tu portal del Club",
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${escapeHtml(greeting)} Tocá el botón para entrar y armar o ver tus códigos.</p>
${button(input.url, "Entrar al portal")}
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b6070">El link vence en ${input.minutes} minutos y sirve una sola vez. Si no lo pediste vos, ignorá este email: nadie puede entrar sin él.</p>`,
  );
  const text = `${greeting}\n\nEntrá a tu portal del Club de Familias iQ con este link (vence en ${input.minutes} minutos y sirve una sola vez):\n${input.url}\n\nSi no lo pediste vos, ignorá este email.`;

  return { subject, html, text };
}

export function buildReferralCreditEmail(input: { firstName: string | null; amountArs: number; balanceArs: number; expiresAt: Date; portalUrl: string }) {
  const greeting = input.firstName ? `¡Hola ${input.firstName}!` : "¡Hola!";
  const subject = `¡Sumaste ${formatArs(input.amountArs)} de crédito en IQ Kids! 🎉`;
  const html = layout(
    `¡Alguien compró con tu código! 🎉`,
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${escapeHtml(greeting)} Ya tenés ${formatArs(input.amountArs)} más de crédito. Tu saldo es de <strong>${formatArs(input.balanceArs)}</strong>.</p>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5">Usalo antes del ${formatArgentinaDate(input.expiresAt)} en iqkids.com.ar con tu código de crédito y tu DNI. Y seguí compartiendo: no hay tope.</p>
${button(input.portalUrl, "Ver mi portal")}`,
  );
  const text = `${greeting}\n\nAlguien compró con tu código: ya tenés ${formatArs(input.amountArs)} más de crédito (saldo ${formatArs(input.balanceArs)}). Usalo antes del ${formatArgentinaDate(input.expiresAt)} en iqkids.com.ar con tu código de crédito y tu DNI.\n\nTu portal: ${input.portalUrl}`;

  return { subject, html, text };
}
