import {
  parseInline,
  splitParagraphs,
  toAbsoluteUrl,
  withNewsletterUtm,
  type NewsletterBlock,
  type NewsletterContent,
  type NewsletterProductSummary,
  type NewsletterTipTone,
} from "@/features/newsletter/content";

// The email is rendered once into a template with placeholders and frozen as the
// newsletter snapshot. Each recipient only gets their own tracking/unsubscribe
// URLs substituted, so later web edits never change what was already emailed.
//
// Placeholders: {{link:N}} (index into `links`), {{unsubscribeUrl}}, {{openPixel}}.

export type NewsletterEmailSnapshot = {
  version: 1;
  subject: string;
  previewText: string;
  html: string;
  text: string;
  links: string[];
  renderedAt: string;
};

const ink = "#2c2241";
const pink = "#F48991";
const cyanStrong = "#2B9CC4";
const cyanSoft = "#EAF8FE";
const pinkSoft = "#FAD5D8";
const muted = "#6f6680";
const pageBackground = "#FFF4F5";
// Brand display font. Apple Mail, iOS Mail, Samsung Mail and Outlook for Mac load it
// from the site; Gmail and Outlook for Windows ignore web fonts and use the fallbacks.
const displayFont = "'Watermelon Regular','Arial Rounded MT Bold','Trebuchet MS','Avenir Next Rounded',Arial,sans-serif";
const bodyFont = "'DM Sans','Segoe UI','Helvetica Neue',Arial,sans-serif";

const tipTones: Record<NewsletterTipTone, { background: string; border: string }> = {
  pink: { background: "#FFF0F1", border: pinkSoft },
  yellow: { background: "#FFF8E0", border: "#FFE7A3" },
  cyan: { background: "#EAF8FE", border: "#BFEAFB" },
  mint: { background: "#EEF9EE", border: "#CDEBCD" },
};

const priceFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildNewsletterEmailSnapshot(input: {
  content: NewsletterContent;
  products: Record<string, NewsletterProductSummary>;
  siteUrl: string;
  webUrl: string | null;
  now?: Date;
}): NewsletterEmailSnapshot {
  const { content, products, siteUrl, webUrl } = input;
  const links: string[] = [];
  const textParts: string[] = [];

  function linkRef(url: string) {
    links.push(withNewsletterUtm(url, siteUrl, content.slug));
    return `{{link:${links.length - 1}}}`;
  }

  function inlineHtml(value: string) {
    return parseInline(value)
      .map((token) => {
        const text = escapeHtml(token.text).replace(/\n/g, "<br />");

        if (token.type === "bold") return `<strong>${text}</strong>`;
        if (token.type === "italic") return `<em>${text}</em>`;
        if (token.type === "link") {
          return `<a href="${linkRef(token.url)}" style="color:${pink};font-weight:700;text-decoration:underline;">${text}</a>`;
        }

        return text;
      })
      .join("");
  }

  function inlineText(value: string) {
    return parseInline(value)
      .map((token) => (token.type === "link" ? `${token.text} (${linkRef(token.url)})` : token.text))
      .join("");
  }

  function paragraphs(value: string, style: string) {
    return splitParagraphs(value)
      .map((paragraph) => `<p style="${style}">${inlineHtml(paragraph)}</p>`)
      .join("");
  }

  function image(url: string, alt: string, width: number, radius = 18) {
    return `<img src="${escapeHtml(toAbsoluteUrl(url, siteUrl))}" width="${width}" alt="${escapeHtml(alt)}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;border-radius:${radius}px;" />`;
  }

  const paragraphStyle = `margin:0 0 16px;font-family:${bodyFont};font-size:16px;line-height:1.7;color:${ink};`;
  const captionStyle = `margin:8px 0 0;font-family:${bodyFont};font-size:13px;line-height:1.5;color:${muted};text-align:center;`;

  function renderBlock(block: NewsletterBlock) {
    switch (block.type) {
      case "heading":
        textParts.push(`\n${block.text.toUpperCase()}\n`);
        return `<h2 style="margin:30px 0 12px;font-family:${displayFont};font-size:23px;line-height:1.25;color:${ink};">${escapeHtml(block.text)}</h2>`;

      case "paragraph":
        textParts.push(splitParagraphs(block.text).map(inlineText).join("\n\n"));
        return paragraphs(block.text, paragraphStyle);

      case "image":
        if (block.caption) textParts.push(`[Imagen: ${block.caption}]`);
        return `<div style="margin:22px 0;">${image(block.url, block.alt, 536)}${block.caption ? `<p style="${captionStyle}">${escapeHtml(block.caption)}</p>` : ""}</div>`;

      case "imageText": {
        textParts.push([block.title, splitParagraphs(block.text).map(inlineText).join("\n\n")].filter(Boolean).join("\n"));
        const imageCell = `<td class="stack" width="46%" valign="top" style="padding:0 ${block.imagePosition === "left" ? "18px 0 0" : "0 0 18px"};">${image(block.url, block.alt, 246)}</td>`;
        const textCell = `<td class="stack" valign="top">${block.title ? `<h3 style="margin:0 0 8px;font-family:${displayFont};font-size:19px;line-height:1.3;color:${ink};">${escapeHtml(block.title)}</h3>` : ""}${paragraphs(block.text, `margin:0 0 12px;font-family:${bodyFont};font-size:15px;line-height:1.65;color:${ink};`)}</td>`;
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>${block.imagePosition === "left" ? imageCell + textCell : textCell + imageCell}</tr></table>`;
      }

      case "gallery": {
        if (block.caption) textParts.push(`[Galería: ${block.caption}]`);
        const width = Math.floor((536 - (block.images.length - 1) * 10) / block.images.length);
        const cells = block.images
          .map((item, index) => `<td class="stack" valign="top" style="padding:${index === 0 ? "0" : "0 0 0 10px"};">${image(item.url, item.alt, width, 14)}</td>`)
          .join("");
        return `<div style="margin:22px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>${block.caption ? `<p style="${captionStyle}">${escapeHtml(block.caption)}</p>` : ""}</div>`;
      }

      case "quote": {
        const accent = block.tone === "cyan" ? cyanStrong : pink;
        const background = block.tone === "cyan" ? cyanSoft : "#FFF4F5";
        textParts.push(`"${block.text}"${block.author ? ` — ${block.author}${block.role ? `, ${block.role}` : ""}` : ""}`);
        return `<div style="margin:26px 0;padding:18px 22px;background:${background};border-left:4px solid ${accent};border-radius:0 18px 18px 0;"><p style="margin:0;font-family:${displayFont};font-size:20px;line-height:1.45;color:${ink};">“${escapeHtml(block.text)}”</p>${block.author ? `<p style="margin:10px 0 0;font-family:${bodyFont};font-size:13px;line-height:1.55;color:${muted};"><strong style="color:${accent};">${escapeHtml(block.author)}</strong>${block.role ? ` — ${escapeHtml(block.role)}` : ""}</p>` : ""}</div>`;
      }

      case "button": {
        const href = linkRef(block.url);
        const background = block.tone === "cyan" ? cyanStrong : pink;
        textParts.push(`${block.label}: ${href}${block.note ? `\n${block.note}` : ""}`);
        return `<div style="margin:26px 0;text-align:center;"><a href="${href}" style="display:inline-block;background:${background};color:#ffffff;text-decoration:none;border-radius:999px;padding:15px 28px;font-family:${bodyFont};font-weight:800;font-size:15px;">${escapeHtml(block.label)}</a>${block.note ? `<p style="margin:10px 0 0;font-family:${bodyFont};font-size:13px;color:${muted};">${escapeHtml(block.note)}</p>` : ""}</div>`;
      }

      case "product": {
        const product = products[block.productId];

        if (!product) {
          return "";
        }

        const href = linkRef(`/productos/${product.slug}`);
        const price = priceFormatter.format(product.priceArs);
        textParts.push(`${product.name} — ${price}${block.note ? `\n${block.note}` : ""}\nComprar: ${href}`);
        const productImage = product.imageUrl
          ? `<td width="150" valign="middle" style="padding:0 18px 0 0;" class="stack">${image(product.imageUrl, product.name, 150, 16)}</td>`
          : "";
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#ffffff;border:1px solid ${pinkSoft};border-radius:22px;"><tr><td style="padding:18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${productImage}<td valign="middle" class="stack"><p style="margin:0 0 4px;font-family:${bodyFont};font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${pink};">Producto destacado</p><p style="margin:0 0 6px;font-family:${displayFont};font-size:20px;line-height:1.25;color:${ink};">${escapeHtml(product.name)}</p>${block.note ? `<p style="margin:0 0 10px;font-family:${bodyFont};font-size:14px;line-height:1.55;color:${muted};">${escapeHtml(block.note)}</p>` : ""}<p style="margin:0 0 14px;font-family:${bodyFont};font-size:20px;font-weight:800;color:${pink};">${price}</p><a href="${href}" style="display:inline-block;background:${ink};color:#ffffff;text-decoration:none;border-radius:999px;padding:11px 22px;font-family:${bodyFont};font-weight:800;font-size:14px;">Comprar</a></td></tr></table></td></tr></table>`;
      }

      case "tip": {
        const tone = tipTones[block.tone];
        textParts.push(`${block.title ? `${block.title}\n` : ""}${splitParagraphs(block.text).map(inlineText).join("\n\n")}`);
        return `<div style="margin:24px 0;padding:20px 22px;background:${tone.background};border:1px solid ${tone.border};border-radius:22px;">${block.title ? `<p style="margin:0 0 8px;font-family:${displayFont};font-size:18px;line-height:1.3;color:${ink};">✨ ${escapeHtml(block.title)}</p>` : ""}${paragraphs(block.text, `margin:0 0 8px;font-family:${bodyFont};font-size:15px;line-height:1.65;color:${ink};`)}</div>`;
      }

      case "stats": {
        const accent = block.tone === "cyan" ? cyanStrong : pink;
        const background = block.tone === "cyan" ? cyanSoft : "#FFF0F1";
        textParts.push(block.items.map((item) => `${item.value}: ${item.label}`).join("\n"));
        const cells = block.items
          .map(
            (item, index) =>
              `<td class="stack" valign="top" width="${Math.floor(100 / block.items.length)}%" style="padding:${index === 0 ? "0" : "0 0 0 10px"};"><div style="background:${background};border-radius:18px;padding:18px 12px;text-align:center;"><p style="margin:0 0 6px;font-family:${displayFont};font-size:30px;line-height:1;color:${accent};">${escapeHtml(item.value)}</p><p style="margin:0;font-family:${bodyFont};font-size:13px;line-height:1.45;color:${ink};">${escapeHtml(item.label)}</p></div></td>`,
          )
          .join("");
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr>${cells}</tr></table>`;
      }

      case "steps": {
        const accent = block.tone === "cyan" ? cyanStrong : pink;
        let number = 0;
        const rows = block.items
          .map((item) => {
            if (item.marker === "number") number += 1;
            const marker = item.marker === "number" ? String(number) : item.marker === "check" ? "✓" : "✗";
            const markerBackground = item.marker === "cross" ? "#9b94a6" : accent;
            textParts.push(`${marker}. ${item.title}${item.text ? `\n${splitParagraphs(item.text).map(inlineText).join(" ")}` : ""}`);
            return `<tr><td style="padding:0 0 10px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F5;border-radius:16px;"><tr><td width="44" valign="top" style="padding:14px 0 14px 14px;"><div style="width:30px;height:30px;line-height:30px;border-radius:15px;background:${markerBackground};color:#ffffff;text-align:center;font-family:${bodyFont};font-size:13px;font-weight:800;">${marker}</div></td><td valign="top" style="padding:14px 16px 14px 10px;"><p style="margin:0 0 4px;font-family:${bodyFont};font-size:15px;font-weight:800;line-height:1.4;color:${ink};">${escapeHtml(item.title)}</p>${item.text ? paragraphs(item.text, `margin:0;font-family:${bodyFont};font-size:14px;line-height:1.55;color:${muted};`) : ""}</td></tr></table></td></tr>`;
          })
          .join("");
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;">${rows}</table>`;
      }

      case "testimonial": {
        textParts.push(`"${block.quote}" — ${block.author}${block.detail ? ` · ${block.detail}` : ""}`);
        const photo = block.imageUrl
          ? `<td width="64" valign="top" style="padding:0 14px 0 0;"><img src="${escapeHtml(toAbsoluteUrl(block.imageUrl, siteUrl))}" width="56" height="56" alt="${escapeHtml(block.imageAlt || block.author)}" style="display:block;width:56px;height:56px;border-radius:28px;border:0;object-fit:cover;" /></td>`
          : "";
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#FFF6F7;border-left:4px solid ${pink};border-radius:0 18px 18px 0;"><tr><td style="padding:18px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${photo}<td valign="top"><p style="margin:0 0 8px;font-family:${bodyFont};font-size:15px;font-style:italic;line-height:1.65;color:${ink};">“${escapeHtml(block.quote)}”</p><p style="margin:0;font-family:${bodyFont};font-size:13px;color:${muted};"><strong style="color:${ink};">${escapeHtml(block.author)}</strong>${block.detail ? ` · ${escapeHtml(block.detail)}` : ""}</p></td></tr></table></td></tr></table>`;
      }

      case "sources":
        textParts.push(`${block.label.toUpperCase()}: ${splitParagraphs(block.text).map(inlineText).join(" ")}`);
        return `<div style="margin:24px 0;padding:14px 18px;background:#F6F3F1;border-radius:14px;"><p style="margin:0 0 6px;font-family:${bodyFont};font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${muted};">${escapeHtml(block.label)}</p>${paragraphs(block.text, `margin:0;font-family:${bodyFont};font-size:12px;line-height:1.6;color:${muted};`)}</div>`;

      case "divider":
        textParts.push("—");
        return `<div style="margin:30px auto;width:72px;height:4px;border-radius:4px;background:${pinkSoft};line-height:4px;font-size:0;">&nbsp;</div>`;
    }
  }

  const title = content.title.trim();
  const subject = content.emailSubject.trim();
  const previewText = (content.emailPreviewText ?? content.excerpt).trim();

  textParts.push(title.toUpperCase());
  if (content.subtitle) textParts.push(content.subtitle);

  const blocksHtml = content.blocks.map(renderBlock).join("");
  const webLink = webUrl ? linkRef(webUrl) : null;
  const logoUrl = `${siteUrl.replace(/\/$/, "")}/brand/iq-kids-logo.png`;
  const cover = content.coverImageUrl
    ? `<tr><td style="padding:0 24px;">${image(content.coverImageUrl, content.coverImageAlt || title, 552, 24)}</td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(subject)}</title>
<style>
  @font-face { font-family: 'Watermelon Regular'; src: url('${siteUrl.replace(/\/$/, "")}/fonts/watermelon-regular.woff2') format('woff2'); font-weight: 400; font-style: normal; }
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; border-radius: 0 !important; }
    .stack { display: block !important; width: 100% !important; padding: 0 0 14px 0 !important; }
    .pad { padding-left: 20px !important; padding-right: 20px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${pageBackground};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(previewText)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${pageBackground};">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:32px;overflow:hidden;">
<tr><td class="pad" style="padding:26px 32px 18px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="middle"><img src="${escapeHtml(logoUrl)}" height="38" alt="IQ Kids" style="display:block;height:38px;width:auto;border:0;" /></td>
<td valign="middle" align="right" style="font-family:${bodyFont};font-size:12px;line-height:1.5;color:${muted};">${content.headerTag ? `<span style="font-weight:700;color:${pink};">${escapeHtml(content.headerTag)}</span>` : ""}${content.headerTag && webLink ? "<br />" : ""}${webLink ? `<a href="${webLink}" style="font-weight:700;color:${muted};text-decoration:underline;">Ver en la web</a>` : ""}</td>
</tr></table>
</td></tr>
${cover}
<tr><td class="pad" style="padding:26px 32px 8px;">
<p style="margin:0 0 10px;font-family:${bodyFont};font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${pink};">${escapeHtml(content.category || "Newsletter IQ Kids")}</p>
<h1 style="margin:0 0 12px;font-family:${displayFont};font-size:31px;line-height:1.15;color:${ink};">${escapeHtml(title)}</h1>
${content.subtitle ? `<p style="margin:0 0 8px;font-family:${bodyFont};font-size:18px;line-height:1.55;color:${muted};">${escapeHtml(content.subtitle)}</p>` : ""}
</td></tr>
<tr><td class="pad" style="padding:8px 32px 30px;">${blocksHtml}</td></tr>
<tr><td class="pad" style="padding:24px 32px 30px;background:#FFF8F8;border-top:1px solid ${pinkSoft};">
<p style="margin:0 0 8px;font-family:${displayFont};font-size:17px;color:${ink};">Una decisión menos, todos los días.</p>
<p style="margin:0 0 12px;font-family:${bodyFont};font-size:13px;line-height:1.6;color:${muted};">Recibís este email porque te suscribiste a la newsletter de IQ Kids.</p>
<p style="margin:0;font-family:${bodyFont};font-size:13px;line-height:1.6;color:${muted};">${webLink ? `<a href="${webLink}" style="color:${muted};text-decoration:underline;">Ver en la web</a> · ` : ""}<a href="{{unsubscribeUrl}}" style="color:${muted};text-decoration:underline;">Darme de baja</a></p>
</td></tr>
</table>
</td></tr>
</table>
{{openPixel}}
</body>
</html>`;

  textParts.push(`\n—\nRecibís este email porque te suscribiste a la newsletter de IQ Kids.`);
  if (webLink) textParts.push(`Ver en la web: ${webLink}`);
  textParts.push(`Darte de baja: {{unsubscribeUrl}}`);

  return {
    version: 1,
    subject,
    previewText,
    html,
    text: textParts.filter(Boolean).join("\n\n"),
    links,
    renderedAt: (input.now ?? new Date()).toISOString(),
  };
}

export function personalizeNewsletterEmail(
  snapshot: Pick<NewsletterEmailSnapshot, "html" | "text" | "links">,
  options: { linkUrl: (index: number, url: string) => string; unsubscribeUrl: string; openPixelUrl: string | null },
) {
  const resolveLink = (_match: string, rawIndex: string) => {
    const index = Number(rawIndex);
    const url = snapshot.links[index];
    return url ? options.linkUrl(index, url) : "#";
  };
  const pixel = options.openPixelUrl
    ? `<img src="${escapeHtml(options.openPixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`
    : "";

  return {
    html: snapshot.html
      .replace(/\{\{link:(\d+)\}\}/g, (match, index: string) => escapeHtml(resolveLink(match, index)))
      .replace(/\{\{unsubscribeUrl\}\}/g, escapeHtml(options.unsubscribeUrl))
      .replace(/\{\{openPixel\}\}/g, pixel),
    text: snapshot.text
      .replace(/\{\{link:(\d+)\}\}/g, resolveLink)
      .replace(/\{\{unsubscribeUrl\}\}/g, options.unsubscribeUrl)
      .replace(/\{\{openPixel\}\}/g, ""),
  };
}

