import { env } from "@/lib/env";
import { formatArs } from "@/lib/utils/currency";

type EmailVariables = Record<string, string | number | null | undefined>;

const brandPink = "#f47f8d";
const brandInk = "#2d2142";
const brandCream = "#fff7ee";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getCouponValueLabel(coupon: {
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountPercentage?: string | number | null;
  fixedDiscountArs?: number | null;
}) {
  if (coupon.discountType === "FIXED_AMOUNT") {
    return `${formatArs(coupon.fixedDiscountArs ?? 0)} OFF`;
  }

  return `${escapeHtml(String(coupon.discountPercentage ?? 0))}% OFF`;
}

export function renderTemplate(template: string, variables: EmailVariables) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) =>
    String(variables[key] ?? ""),
  );
}

export function renderMarketingEmail({
  subject,
  previewText,
  bodyText,
  ctaLabel,
  ctaUrl,
  openTrackingUrl,
  freeShippingMessage,
  coupon,
}: {
  subject: string;
  previewText?: string | null;
  bodyText: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  openTrackingUrl?: string | null;
  freeShippingMessage?: string | null;
  coupon?: {
    code: string;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    discountPercentage?: string | number | null;
    fixedDiscountArs?: number | null;
    headline?: string | null;
    message?: string | null;
  } | null;
}) {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:${brandInk};font-size:16px;line-height:1.65;">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");

  const cta =
    ctaLabel && ctaUrl
      ? `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${brandPink};color:#fff;text-decoration:none;border-radius:999px;padding:15px 24px;font-weight:800;font-size:15px;">${escapeHtml(ctaLabel)}</a>`
      : "";

  const safePreviewText = previewText?.trim() ? escapeHtml(previewText.trim()) : "";
  const freeShippingBlock = freeShippingMessage?.trim()
    ? `<div style="margin:22px 0 20px;border:1px solid #99d9bd;background:#effbf4;border-radius:22px;padding:18px;">
        <p style="margin:0 0 7px;color:#278460;font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;">Envío bonificado</p>
        <p style="margin:0;color:${brandInk};font-size:15px;line-height:1.55;">${escapeHtml(freeShippingMessage.trim()).replace(/\n/g, "<br />")}</p>
      </div>`
    : "";
  const couponBlock = coupon
    ? `<div style="margin:22px 0 20px;border:1px dashed ${brandPink};background:#fff7f8;border-radius:22px;padding:18px 18px 16px;">
        <p style="margin:0 0 7px;color:${brandPink};font-size:12px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;">${escapeHtml(coupon.headline?.trim() || "Regalo IQ Kids")}</p>
        <p style="margin:0 0 10px;color:${brandInk};font-size:15px;line-height:1.55;">${escapeHtml(coupon.message?.trim() || "Usa este cupon en tu compra.")}</p>
        <div style="display:inline-block;background:#ffffff;border:1px solid rgba(244,127,141,.45);border-radius:16px;padding:12px 16px;">
          <span style="display:block;color:rgba(45,33,66,.55);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">Cupon</span>
          <span style="display:block;color:${brandInk};font-size:24px;font-weight:900;letter-spacing:.08em;">${escapeHtml(coupon.code)}</span>
        </div>
        <span style="display:inline-block;margin-left:10px;color:${brandPink};font-size:14px;font-weight:900;">${getCouponValueLabel(coupon)}</span>
      </div>`
    : "";

  const hiddenPreview = safePreviewText
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;font-size:1px;">${safePreviewText}</div><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;font-size:1px;">&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : "";
  const openTrackingPixel = openTrackingUrl
    ? `<img src="${escapeHtml(openTrackingUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none;text-decoration:none;" />`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:${brandCream};font-family:Arial,Helvetica,sans-serif;">
    ${hiddenPreview}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brandCream};padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:28px;overflow:hidden;border:1px solid rgba(45,33,66,.10);">
            <tr>
              <td style="background:${brandPink};padding:22px 28px;color:#fff;font-size:24px;font-weight:800;">IQ Kids</td>
            </tr>
            <tr>
              <td style="padding:34px 28px 30px;">
                <h1 style="margin:0 0 18px;color:${brandInk};font-size:30px;line-height:1.12;">${escapeHtml(subject)}</h1>
                ${safePreviewText ? `<p style="margin:0 0 18px;color:rgba(45,33,66,.72);font-size:15px;line-height:1.6;">${safePreviewText}</p>` : ""}
                ${paragraphs}
                ${freeShippingBlock}
                ${couponBlock}
                ${cta ? `<div style="padding-top:10px;">${cta}</div>` : ""}
                <p style="margin:28px 0 0;color:rgba(45,33,66,.55);font-size:12px;line-height:1.5;">Snacks simples y naturales para todos los dias.</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;color:rgba(45,33,66,.45);font-size:11px;">${escapeHtml(env.NEXT_PUBLIC_SITE_URL)}</p>
        </td>
      </tr>
    </table>
    ${openTrackingPixel}
  </body>
</html>`;
}
