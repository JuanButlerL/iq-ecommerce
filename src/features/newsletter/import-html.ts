import {
  createBlockId,
  getBlockPlainText,
  isSafeImageUrl,
  isSafeLinkUrl,
  stripInline,
  type NewsletterAccentTone,
  type NewsletterBlock,
  type NewsletterContent,
  type NewsletterFeature,
  type NewsletterPromo,
  type NewsletterStat,
  type NewsletterStepMarker,
} from "@/features/newsletter/content";
import { EMAIL_HTML_UNSUBSCRIBE_HREF, EMAIL_HTML_WEB_HREF, emailHtmlToText, sanitizeEmailCss, sanitizeEmailHtml, sanitizeInlineStyle } from "@/features/newsletter/email-html";

// Converts the "newsletter sequence" HTML format (one `.email-view` per email, with
// `.email-body` blocks such as `.stat-row`, `.system-list`, `.testi-card`) and the
// "email preview" format (one `.email-section` per email, see parsePreviewSection) into
// editable newsletter drafts made of validated blocks. Unknown elements degrade to
// plain paragraphs and suggested photos / implementation notes go to internal notes.
//
// Any other HTML is treated as a ready-made email (tables + inline styles, as sent by
// Mailchimp, Klaviyo, Canva, agencies or hand-written) and imported as authored: one
// "HTML de email" block with the sanitized design, so it looks exactly the same in the
// email and on the web (see parseStandaloneEmail). Runs in the admin browser with DOMParser.

export type ImportedNewsletter = {
  content: Omit<NewsletterContent, "slug">;
  internalNotes: string;
  sourceLabel: string;
};

const DEFAULT_BUTTON_URL = "/productos";

function clean(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function stripQuotes(value: string) {
  return value.replace(/^[\s"“”«]+|[\s"“”»]+$/g, "");
}

// Inline HTML -> **bold**, *italic*, [text](url). Anything else becomes text.
function toInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\s+/g, " ");
  }

  if (!(node instanceof Element)) {
    return "";
  }

  const inner = Array.from(node.childNodes).map(toInline).join("");
  const tag = node.tagName.toLowerCase();

  if (tag === "br") return "\n";
  if ((tag === "strong" || tag === "b") && inner.trim()) return `**${inner.trim()}**`;
  if ((tag === "em" || tag === "i") && inner.trim()) return `*${inner.trim()}*`;
  if (tag === "a") {
    const href = node.getAttribute("href") ?? "";
    return href && href !== "#" && isSafeLinkUrl(href) ? `[${inner.trim()}](${href})` : inner;
  }

  return inner;
}

function inlineText(element: Element | null) {
  return element ? Array.from(element.childNodes).map(toInline).join("").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim() : "";
}

function truncateAtWord(value: string, max: number) {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2)).trim()}…`;
}

function firstSentence(value: string, max: number) {
  const match = value.match(/^.{20,}?[.!?](\s|$)/);
  const sentence = match ? match[0].trim() : value;
  return truncateAtWord(sentence, max);
}

function toneFromStyle(element: Element | null, fallback: "pink" | "cyan" = "pink"): "pink" | "cyan" {
  const style = `${element?.getAttribute("style") ?? ""} ${element?.className ?? ""}`.toLowerCase();
  if (style.includes("teal")) return "cyan";
  if (style.includes("rosa")) return "pink";
  return fallback;
}

function markerFrom(text: string): NewsletterStepMarker {
  const value = text.trim();
  if (value === "✓" || value === "✔") return "check";
  if (value === "✗" || value === "✕" || value === "✘" || value.toLowerCase() === "x") return "cross";
  return "number";
}

function parseView(view: Element, index: number): ImportedNewsletter | null {
  const body = view.querySelector(".email-body");

  if (!body) {
    return null;
  }

  const blocks: NewsletterBlock[] = [];
  const notes: string[] = [];
  let title = "";
  let category = "";
  let replacedButtonLinks = 0;
  let lastWasParagraph = false;

  const push = (block: NewsletterBlock) => {
    blocks.push(block);
    lastWasParagraph = block.type === "paragraph";
  };

  for (const element of Array.from(body.children)) {
    const classes = element.classList;
    const tag = element.tagName.toLowerCase();

    if (classes.contains("eyebrow")) {
      category = clean(element.textContent);
    } else if (tag === "h1" || classes.contains("email-h1")) {
      title = clean(element.textContent);
    } else if (classes.contains("divider")) {
      if (blocks.length > 0 && blocks.at(-1)?.type !== "divider") push({ id: createBlockId(), type: "divider" });
    } else if (classes.contains("stat-row")) {
      const cards = Array.from(element.querySelectorAll(".stat-card")).slice(0, 3);
      push({
        id: createBlockId(),
        type: "stats",
        tone: toneFromStyle(element.querySelector(".stat-num"), "cyan"),
        items: cards.map((card) => ({ value: clean(card.querySelector(".stat-num")?.textContent), label: clean(card.querySelector(".stat-label")?.textContent) })),
      });
    } else if (classes.contains("quote-block")) {
      const authorElement = element.querySelector(".quote-author");
      const author = clean(authorElement?.querySelector("strong")?.textContent);
      const role = author ? clean(authorElement?.textContent).replace(author, "").replace(/^\s*[—–-]\s*/, "") : "";
      push({
        id: createBlockId(),
        type: "quote",
        text: stripQuotes(clean(element.querySelector(".quote-text")?.textContent)),
        author: author || null,
        role: role || null,
        tone: classes.contains("teal-q") ? "cyan" : toneFromStyle(element),
      });
    } else if (classes.contains("system-list")) {
      const items = Array.from(element.querySelectorAll(".system-item")).slice(0, 10);
      push({
        id: createBlockId(),
        type: "steps",
        tone: toneFromStyle(element.querySelector(".system-num")),
        items: items.map((item) => ({
          title: clean(item.querySelector(".system-title")?.textContent),
          text: inlineText(item.querySelector(".system-desc")),
          marker: markerFrom(item.querySelector(".system-num")?.textContent ?? ""),
        })),
      });
    } else if (classes.contains("testi-card")) {
      const [author, ...detail] = clean(element.querySelector(".testi-meta")?.textContent).split(" · ");
      push({
        id: createBlockId(),
        type: "testimonial",
        quote: stripQuotes(clean(element.querySelector(".testi-text")?.textContent)),
        author: author || "Cliente IQ Kids",
        detail: detail.join(" · ") || null,
        imageUrl: null,
        imageAlt: null,
      });
    } else if (classes.contains("highlight-box")) {
      push({ id: createBlockId(), type: "tip", title: null, tone: "pink", text: inlineText(element.querySelector("p") ?? element) });
    } else if (classes.contains("source-note")) {
      push({
        id: createBlockId(),
        type: "sources",
        label: clean(element.querySelector(".source-label")?.textContent) || "Fuentes",
        text: inlineText(element.querySelector(".source-text") ?? element),
      });
    } else if (classes.contains("cta-wrap")) {
      const link = element.querySelector("a");
      const href = link?.getAttribute("href") ?? "";
      const url = href && href !== "#" && isSafeLinkUrl(href) ? href : DEFAULT_BUTTON_URL;
      if (url === DEFAULT_BUTTON_URL && href !== DEFAULT_BUTTON_URL) replacedButtonLinks += 1;
      push({
        id: createBlockId(),
        type: "button",
        label: clean(link?.textContent) || "Ver productos",
        url,
        note: null,
        tone: link?.classList.contains("teal") ? "cyan" : "pink",
      });
    } else if (classes.contains("cta-note")) {
      const last = blocks.at(-1);
      if (last?.type === "button") last.note = clean(element.textContent);
      else push({ id: createBlockId(), type: "paragraph", text: inlineText(element) });
    } else if (tag === "p") {
      const style = (element.getAttribute("style") ?? "").replace(/\s/g, "");
      const text = inlineText(element);

      if (!text) continue;

      if (style.includes("font-weight:600") || style.includes("font-weight:700")) {
        push({ id: createBlockId(), type: "heading", text: clean(element.textContent) });
      } else if (lastWasParagraph) {
        const last = blocks.at(-1);
        if (last?.type === "paragraph") last.text = `${last.text}\n\n${text}`;
      } else {
        push({ id: createBlockId(), type: "paragraph", text });
      }
    } else {
      const text = inlineText(element);
      if (text) push({ id: createBlockId(), type: "paragraph", text });
    }
  }

  const meta = [clean(view.querySelector(".meta-label")?.textContent), clean(view.querySelector(".meta-trigger")?.textContent)].filter(Boolean).join(" · ");
  const subject = clean(view.querySelector(".meta-subject")?.textContent).replace(/^asunto:\s*/i, "");
  const headerTag = clean(view.querySelector(".email-header-tag")?.textContent);
  const placeholder = view.querySelector(".email-img-placeholder");
  const photo = clean(placeholder?.querySelector(".img-label")?.textContent);
  const photoDescription = clean(placeholder?.lastElementChild?.textContent);
  const firstParagraph = blocks.find((block) => block.type === "paragraph");
  const firstText = firstParagraph?.type === "paragraph" ? stripInline(firstParagraph.text.split("\n\n")[0] ?? "") : "";
  const sourceLabel = meta || `Newsletter ${index + 1}`;

  notes.push(`Importada del HTML de la secuencia: ${sourceLabel}.`);
  if (photo) notes.push(`${photo}${photoDescription && photoDescription !== photo ? ` — ${photoDescription}` : ""}. Subir la foto como portada.`);
  if (replacedButtonLinks > 0) notes.push(`El link original de ${replacedButtonLinks === 1 ? "un botón" : `${replacedButtonLinks} botones`} era "#": se puso ${DEFAULT_BUTTON_URL}. Revisar.`);
  const originalNotes = Array.from(view.querySelectorAll(".nota li")).map((item) => `- ${clean(item.textContent)}`);
  if (originalNotes.length > 0) notes.push(["Notas originales:", ...originalNotes].join("\n"));

  const finalTitle = truncateAtWord(title || subject || `Newsletter ${index + 1}`, 140);

  return {
    sourceLabel,
    internalNotes: notes.join("\n\n").slice(0, 5000),
    content: {
      title: finalTitle,
      subtitle: null,
      excerpt: truncateAtWord(firstText.length >= 10 ? firstText : finalTitle, 400),
      category: category ? truncateAtWord(category, 60) : null,
      headerTag: headerTag ? truncateAtWord(headerTag, 80) : null,
      coverImageUrl: null,
      coverImageAlt: null,
      blocks,
      emailSubject: truncateAtWord(subject || finalTitle, 120),
      emailPreviewText: firstText ? firstSentence(firstText, 150) : null,
    },
  };
}

// Text without inline marks, with <br> as spaces: for titles, labels and metadata.
function plainText(element: Element | null) {
  return clean(stripInline(inlineText(element)).replace(/\n/g, " "));
}

// Links to the store's own domain become relative paths. "/products" (English) does not
// exist in this store, so it is pointed to "/productos" and flagged for review.
function storeLinkFrom(href: string) {
  try {
    const url = new URL(href, "https://iqkids.com.ar");
    const isOwnSite = url.hostname.replace(/^www\./, "") === "iqkids.com.ar";

    if (isOwnSite && (url.pathname === "/products" || url.pathname.startsWith("/products/"))) {
      return { url: DEFAULT_BUTTON_URL, fixed: true };
    }

    if (isOwnSite) {
      return { url: `${url.pathname}${url.search}` || DEFAULT_BUTTON_URL, fixed: false };
    }
  } catch {
    // Falls through to the safety check below.
  }

  return { url: href && href !== "#" && isSafeLinkUrl(href) ? href : DEFAULT_BUTTON_URL, fixed: !href || href === "#" };
}

// Converts the "email preview" HTML format: one `.email-section` per email, with the
// send date, subject and preheader in `.email-meta` and the content in `.email-body`
// (`.email-header`, `.cyber-badge-wrap`, `.email-content`, `.info-strip`, `.email-footer`).
function parsePreviewSection(section: Element, index: number, tabLabels: string[]): ImportedNewsletter | null {
  const body = section.querySelector(".email-body");

  if (!body) {
    return null;
  }

  const blocks: NewsletterBlock[] = [];
  const notes: string[] = [];
  let title = "";
  let category = "";
  let fixedButtonLinks = 0;
  let skippedCountdowns = 0;
  let lastWasParagraph = false;

  const push = (block: NewsletterBlock) => {
    blocks.push(block);
    lastWasParagraph = block.type === "paragraph";
  };

  const pushParagraph = (text: string) => {
    if (!text) return;
    const last = blocks.at(-1);
    if (lastWasParagraph && last?.type === "paragraph") last.text = `${last.text}\n\n${text}`;
    else push({ id: createBlockId(), type: "paragraph", text });
  };

  const meta = new Map<string, string>();
  for (const row of Array.from(section.querySelectorAll(".email-meta-row"))) {
    const label = plainText(row.querySelector(".email-meta-label")).toLowerCase();
    if (label) meta.set(label, plainText(row.querySelector(".email-meta-val")));
  }
  const subject = meta.get("asunto") ?? "";
  const preheader = meta.get("preheader") ?? "";
  const sendDate = meta.get("envío") ?? meta.get("envio") ?? "";

  const lastChance = body.querySelector(".last-chance-banner");
  if (lastChance) push({ id: createBlockId(), type: "tip", title: null, tone: "pink", text: plainText(lastChance) });

  const badgeWrap = body.querySelector(".cyber-badge-wrap");
  if (badgeWrap) {
    title = plainText(badgeWrap.querySelector(".cyber-title"));
    category = plainText(badgeWrap.querySelector(".cyber-badge"));
    pushParagraph(inlineText(badgeWrap.querySelector(".cyber-subtitle")));
  }

  const parseContentElement = (element: Element) => {
    const classes = element.classList;

    if (classes.contains("email-eyebrow")) {
      category = plainText(element);
    } else if (classes.contains("email-h2") || element.tagName.toLowerCase() === "h2") {
      const text = plainText(element);
      if (!title) title = text;
      else if (text) push({ id: createBlockId(), type: "heading", text: truncateAtWord(text, 160) });
    } else if (classes.contains("email-divider")) {
      if (blocks.length > 0 && blocks.at(-1)?.type !== "divider") push({ id: createBlockId(), type: "divider" });
    } else if (classes.contains("email-quote")) {
      const cite = plainText(element.querySelector("cite")).replace(/^[—–-]\s*/, "");
      const [author, ...role] = cite.split(",");
      push({
        id: createBlockId(),
        type: "quote",
        text: stripQuotes(plainText(element.querySelector("p"))),
        author: clean(author) || null,
        role: clean(role.join(",")) || null,
        tone: "pink",
      });
    } else if (classes.contains("promo-grid")) {
      const items = Array.from(element.querySelectorAll(".promo-card"))
        .slice(0, 3)
        .map((card) => ({
          value: truncateAtWord(plainText(card.querySelector(".promo-card-title")) || "Promo", 40),
          label: plainText(card.querySelector(".promo-card-tag")) || null,
          text: truncateAtWord(inlineText(card.querySelector(".promo-card-desc")), 500),
          code: plainText(card.querySelector(".promo-code")) || null,
          tone: card.querySelector(".promo-card-header")?.classList.contains("teal") ? ("cyan" as const) : ("pink" as const),
        }));
      if (items.length > 0) push({ id: createBlockId(), type: "promos", items });
    } else if (classes.contains("email-cta-wrap")) {
      const link = element.querySelector("a");
      const { url, fixed } = storeLinkFrom(link?.getAttribute("href") ?? "");
      if (fixed) fixedButtonLinks += 1;
      push({
        id: createBlockId(),
        type: "button",
        label: truncateAtWord(plainText(link) || "Ver productos", 80),
        url,
        note: null,
        tone: link?.classList.contains("teal") ? "cyan" : "pink",
      });
    } else if (classes.contains("countdown-strip")) {
      skippedCountdowns += 1;
    } else if (classes.contains("email-p") || element.tagName.toLowerCase() === "p") {
      const text = inlineText(element);
      const style = (element.getAttribute("style") ?? "").replace(/\s/g, "");
      if (!text) return;
      if (style.includes("background")) push({ id: createBlockId(), type: "tip", title: null, tone: "yellow", text });
      else pushParagraph(text);
    } else {
      pushParagraph(inlineText(element));
    }
  };

  for (const element of Array.from(body.querySelector(".email-content")?.children ?? [])) {
    parseContentElement(element);
  }

  const infoItems = Array.from(body.querySelectorAll(".info-strip .info-item")).slice(0, 10);
  if (infoItems.length > 0) {
    push({
      id: createBlockId(),
      type: "steps",
      tone: "pink",
      items: infoItems.map((item) => ({ title: plainText(item.querySelector(".info-title")), text: plainText(item.querySelector(".info-desc")), marker: "check" as const })),
    });
  }

  // Footer fine print (terms of the promo) is kept; the brand line and the
  // unsubscribe / browser links are dropped because the newsletter adds its own footer.
  const finePrint = inlineText(body.querySelector(".email-footer p"))
    .split("\n")
    .map((line) => clean(line))
    .filter((line) => line && !/iqkids\.com\.ar|desuscribirse|ver en el navegador/i.test(line));
  if (finePrint.length > 0) push({ id: createBlockId(), type: "paragraph", text: finePrint.join("\n") });

  if (blocks.length === 0 && !title) {
    return null;
  }

  const headerTag = plainText(body.querySelector(".email-header-tag"));
  const firstParagraph = blocks.find((block) => block.type === "paragraph");
  const firstText = firstParagraph?.type === "paragraph" ? stripInline(firstParagraph.text.split("\n\n")[0] ?? "") : "";
  const sourceLabel = tabLabels[index] || sendDate || `Newsletter ${index + 1}`;
  const finalTitle = truncateAtWord(title || subject || `Newsletter ${index + 1}`, 140);

  notes.push(`Importada del HTML de vista previa: ${sourceLabel}.`);
  if (sendDate) notes.push(`Envío sugerido en el original: ${sendDate}.`);
  if (skippedCountdowns > 0) notes.push("Se omitió la cuenta regresiva del original (era un número fijo).");
  if (fixedButtonLinks > 0) notes.push(`${fixedButtonLinks === 1 ? "Un botón apuntaba" : `${fixedButtonLinks} botones apuntaban`} a una página que no existe (/products o "#"): se puso ${DEFAULT_BUTTON_URL}. Revisar.`);

  return {
    sourceLabel,
    internalNotes: notes.join("\n\n").slice(0, 5000),
    content: {
      title: finalTitle,
      subtitle: null,
      excerpt: truncateAtWord(firstText.length >= 10 ? firstText : finalTitle, 400),
      category: category ? truncateAtWord(category, 60) : null,
      headerTag: headerTag ? truncateAtWord(headerTag, 80) : null,
      coverImageUrl: null,
      coverImageAlt: null,
      blocks,
      emailSubject: truncateAtWord(subject || finalTitle, 120),
      emailPreviewText: preheader ? truncateAtWord(preheader, 150) : firstText ? firstSentence(firstText, 150) : null,
    },
  };
}

const UNSUBSCRIBE_TEXT = /desuscrib|dar(me|te|se)? de baja|unsubscribe|cancelar (la |tu )?suscripci|no (quiero|deseo) recibir/i;
const UNSUBSCRIBE_HREF = /\*\|unsub|\{\{\s*unsubscribe|%unsubscribe|\[unsubscribe|unsubscribe_url|\/unsubscribe/i;
const WEB_VIEW_TEXT = /ver (este (e-?mail|correo|mail) )?en (el |tu )?navegador|ver en la web|ver (la )?versi[oó]n web|ver online|view (this email )?in (your )?browser|view online/i;
const WEB_VIEW_HREF = /\*\|archive|\{\{\s*(web_?version|view_in_browser)|%webversion|\[webversion/i;

function commentValue(doc: Document, keys: RegExp) {
  const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_COMMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const match = (node.nodeValue ?? "").match(new RegExp(`^\\s*(?:${keys.source})\\s*:\\s*([\\s\\S]+?)\\s*$`, "i"));
    if (match?.[1]) return clean(match[1]);
  }
  return "";
}

// A ready-made email document. Its design is kept as authored (sanitized); only the
// links are adapted: "Desuscribirse" / "Ver en el navegador" become the newsletter's
// own links, "#" links become text and /products is pointed to /productos.
function parseStandaloneEmail(doc: Document, fallbackLabel: string): ImportedNewsletter | null {
  const body = doc.body;

  if (!body || !clean(body.textContent) && !body.querySelector("img")) {
    return null;
  }

  const notes: string[] = [];
  let removedLinks = 0;
  let fixedLinks = 0;
  let unsubscribeLinks = 0;
  let webLinks = 0;

  // Hidden preheader text at the top of the body: the newsletter adds its own one.
  let hiddenPreheader = "";
  for (const element of Array.from(body.querySelectorAll<HTMLElement>("[style]")).slice(0, 5)) {
    const style = (element.getAttribute("style") ?? "").replace(/\s/g, "").toLowerCase();
    if (style.includes("display:none") && clean(element.textContent)) {
      hiddenPreheader = clean(element.textContent);
      element.remove();
      break;
    }
  }

  for (const link of Array.from(body.querySelectorAll("a"))) {
    const href = (link.getAttribute("href") ?? "").trim();
    const text = clean(link.textContent);

    if (UNSUBSCRIBE_HREF.test(href) || UNSUBSCRIBE_TEXT.test(text)) {
      link.setAttribute("href", EMAIL_HTML_UNSUBSCRIBE_HREF);
      unsubscribeLinks += 1;
    } else if (WEB_VIEW_HREF.test(href) || WEB_VIEW_TEXT.test(text)) {
      link.setAttribute("href", EMAIL_HTML_WEB_HREF);
      webLinks += 1;
    } else if (!href || href === "#" || /^(\*\||\{\{|%)/.test(href)) {
      link.removeAttribute("href");
      removedLinks += 1;
    } else {
      const { url, fixed } = storeLinkFrom(href);
      if (fixed) fixedLinks += 1;
      link.setAttribute("href", url);
    }
  }

  const lostImages = Array.from(body.querySelectorAll("img")).filter((image) => !isSafeImageUrl(image.getAttribute("src") ?? "")).length;

  // The <body> background and font are part of the design: kept on a wrapper.
  const bodyStyle = [body.getAttribute("bgcolor") ? `background-color:${body.getAttribute("bgcolor")}` : "", sanitizeInlineStyle(body.getAttribute("style") ?? "")]
    .filter(Boolean)
    .join(";");
  const html = sanitizeEmailHtml(bodyStyle ? `<div style="${bodyStyle.replace(/"/g, "'")}">${body.innerHTML}</div>` : body.innerHTML);
  const css = sanitizeEmailCss(Array.from(doc.querySelectorAll("style")).map((style) => style.textContent ?? "").join("\n"));

  if (!html) {
    return null;
  }

  const headline = plainText(body.querySelector("h1")) || plainText(body.querySelector("h2"));
  const subject = commentValue(doc, /subject|asunto/) || clean(doc.title) || headline;
  const preheader = commentValue(doc, /preheader|preview|pre-header|vista previa/) || hiddenPreheader;
  const firstText = Array.from(body.querySelectorAll("p"))
    .map((paragraph) => plainText(paragraph))
    .find((text) => text.length >= 30) ?? "";
  const finalTitle = truncateAtWord(headline || subject || fallbackLabel, 140);
  const excerptSource = preheader || firstText || emailHtmlToText(html);

  notes.push(`Importada tal cual del HTML del email (${fallbackLabel}): se mantiene el diseño original. Para cambiar textos, editá el bloque "HTML de email".`);
  if (unsubscribeLinks > 0) notes.push('El link "Desuscribirse" del original ahora da de baja de la newsletter.');
  else notes.push("El original no tenía link para darse de baja: al enviarlo se agrega uno al pie.");
  if (webLinks > 0) notes.push('El link "Ver en el navegador" lleva a esta newsletter en la web (si está publicada).');
  if (removedLinks > 0) notes.push(`${removedLinks === 1 ? "Un link del original era" : `${removedLinks} links del original eran`} "#" (sin destino): quedaron como texto. Revisar.`);
  if (fixedLinks > 0) notes.push(`${fixedLinks === 1 ? "Un link apuntaba" : `${fixedLinks} links apuntaban`} a /products, que no existe: se cambió por ${DEFAULT_BUTTON_URL}.`);
  if (lostImages > 0) notes.push(`${lostImages === 1 ? "Una imagen no tenía" : `${lostImages} imágenes no tenían`} una dirección https y no se muestran. Subilas y reemplazá el src en el HTML.`);

  return {
    sourceLabel: fallbackLabel,
    internalNotes: notes.join("\n\n").slice(0, 5000),
    content: {
      title: finalTitle,
      subtitle: null,
      excerpt: truncateAtWord(excerptSource.length >= 10 ? excerptSource : `${finalTitle} — newsletter de IQ Kids`, 400),
      category: null,
      headerTag: null,
      coverImageUrl: null,
      coverImageAlt: null,
      blocks: [{ id: createBlockId(), type: "html", html, css: css || null, fullEmail: true }],
      emailSubject: truncateAtWord(subject || finalTitle, 120),
      emailPreviewText: preheader ? truncateAtWord(preheader, 150) : firstText ? firstSentence(firstText, 150) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Ready-made emails → brand blocks
// ---------------------------------------------------------------------------
// Reads the STRUCTURE of any email built with tables and inline styles (announcement
// strip, eyebrow, headline, paragraphs, promo cards with codes, button + fine print,
// benefits strip, footer) and rebuilds it with the newsletter blocks, so it keeps the
// layout but is sent and published with the IQ Kids brand (colors, fonts, logo,
// footer). Only the content is taken from the original, never its colors or fonts.

type Rgb = [number, number, number];

const CONTAINER_SELECTOR = "table,thead,tbody,tfoot,tr,td,th,div,p,h1,h2,h3,h4,h5,h6,ul,ol,li,blockquote,center,section,article,header,footer,main,aside,hr,img";
const CODE_LABEL = /^(c[oó]digo|cup[oó]n|code|coupon|us[aá] el c[oó]digo)\s*:?$/i;
const STORE_NAME = /^i\s?q\s?kids\b/i;

function styleValue(element: Element, property: string) {
  const style = element.getAttribute("style") ?? "";
  const match = style.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i"));
  return match?.[1]?.trim().toLowerCase() ?? null;
}

function parseColor(value: string | null | undefined): Rgb | null {
  if (!value) return null;
  const hex = value.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
    return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
  }
  const rgb = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

function backgroundOf(element: Element): Rgb | null {
  return parseColor(styleValue(element, "background-color") ?? styleValue(element, "background") ?? element.getAttribute("bgcolor"));
}

function luminance([r, g, b]: Rgb) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// A real color (not white / cream / light grey), as used for strips and card headers.
function isAccent(color: Rgb | null): color is Rgb {
  if (!color) return false;
  const saturation = Math.max(...color) - Math.min(...color);
  return luminance(color) < 0.86 && (saturation > 40 || luminance(color) < 0.3);
}

function toneOfColor(color: Rgb | null, fallback: NewsletterAccentTone = "pink"): NewsletterAccentTone {
  if (!color) return fallback;
  const [r, g, b] = color;
  if (b > r && g > r * 0.9) return "cyan";
  if (r >= b) return "pink";
  return fallback;
}

function fontSizeOf(element: Element | null, stop?: Element) {
  for (let current = element; current && current !== stop?.parentElement; current = current.parentElement) {
    const size = styleValue(current, "font-size");
    const px = size?.match(/^([\d.]+)px/)?.[1];
    if (px) return Number(px);
    if (current === stop) break;
  }
  return null;
}

function isBold(element: Element) {
  const weight = styleValue(element, "font-weight");
  if (weight && (weight === "bold" || weight === "bolder" || Number(weight) >= 600)) return true;
  if (/^(strong|b|h[1-6])$/i.test(element.tagName)) return true;
  const only = element.children.length === 1 ? element.children[0] : null;
  return Boolean(only && /^(strong|b)$/i.test(only.tagName) && clean(only.textContent) === clean(element.textContent));
}

function isHiddenElement(element: Element) {
  const display = styleValue(element, "display");
  return display === "none" || styleValue(element, "mso-hide") === "all" || element.hasAttribute("hidden");
}

// Block-level children: block tags, or anything the browser laid out as a block
// (marked by normalizeWithLayout, e.g. <b style="display:block">).
function hasContainerChild(element: Element): boolean {
  return Array.from(element.children).some((child) => child.matches(CONTAINER_SELECTOR) || child.hasAttribute("data-iq-block") || hasContainerChild(child));
}

function isContainer(node: Node) {
  return node instanceof Element && (node.matches(CONTAINER_SELECTOR) || node.hasAttribute("data-iq-block") || hasContainerChild(node));
}

// Text that sits loose next to blocks ("Ideal para probar<br><div>CÓDIGO</div>") is
// wrapped in its own <p>, so every piece of text becomes a leaf the reader can place.
function wrapLooseText(root: Element) {
  for (const element of Array.from(root.querySelectorAll("*")).reverse()) {
    if (!Array.from(element.childNodes).some(isContainer)) continue;
    let run: Node[] = [];
    const flush = () => {
      if (run.some((node) => clean(node.textContent))) {
        const wrapper = element.ownerDocument.createElement("p");
        run[0]!.parentNode!.insertBefore(wrapper, run[0]!);
        run.forEach((node) => wrapper.appendChild(node));
      }
      run = [];
    };
    for (const node of Array.from(element.childNodes)) {
      if (isContainer(node)) flush();
      else if (node.nodeType === Node.TEXT_NODE || node instanceof Element) run.push(node);
    }
    flush();
  }
}

// Text leaves in document order: elements with text and no block-level children.
function leavesOf(root: Element): Element[] {
  const result: Element[] = [];
  const walk = (element: Element) => {
    if (isHiddenElement(element)) return;
    if (!hasContainerChild(element)) {
      if (clean(element.textContent)) result.push(element);
      return;
    }
    Array.from(element.children).forEach(walk);
  };
  walk(root);
  return result;
}

function isEmojiOnly(value: string) {
  const text = value.replace(/\s|️|‍/g, "");
  return text.length > 0 && text.length <= 8 && /^\p{Extended_Pictographic}+$/u.test(text);
}

function buttonLink(element: Element): HTMLAnchorElement | null {
  const link = element.tagName.toLowerCase() === "a" ? (element as HTMLAnchorElement) : element.querySelector("a");
  if (!link || clean(link.textContent) !== clean(element.textContent)) return null;
  const looksLikeButton = isAccent(backgroundOf(link)) || (styleValue(link, "display") === "inline-block" && Boolean(styleValue(link, "padding"))) || isAccent(backgroundOf(element));
  return looksLikeButton ? link : null;
}

function isCodeElement(element: Element): boolean {
  const text = clean(element.textContent);
  if (!/^[A-Z0-9][A-Z0-9_-]{2,24}$/.test(text)) return false;
  const style = (element.getAttribute("style") ?? "").toLowerCase();
  if (style.includes("dashed") || style.includes("dotted") || style.includes("monospace") || /^(code|kbd|tt)$/i.test(element.tagName)) return true;
  const only = element.children.length === 1 ? element.children[0]! : null;
  return Boolean(only && clean(only.textContent) === text && isCodeElement(only));
}

function contentCells(row: Element) {
  const isTableRow = row.tagName.toLowerCase() === "tr";
  return Array.from(row.children).filter(
    (cell) => (!isTableRow || /^(td|th)$/i.test(cell.tagName)) && !isHiddenElement(cell) && (clean(cell.textContent) || cell.tagName.toLowerCase() === "img" || cell.querySelector("img")),
  );
}

function soleImage(cell: Element) {
  if (clean(cell.textContent)) return null;
  const image = cell.tagName.toLowerCase() === "img" ? cell : cell.querySelector("img");
  return image && isSafeImageUrl(image.getAttribute("src") ?? "") ? image : null;
}

function parsePromoCards(cells: Element[]): NewsletterPromo[] | null {
  const promos: NewsletterPromo[] = [];

  for (const [index, cell] of cells.entries()) {
    const leaves = leavesOf(cell);
    const big = leaves.find((leaf) => (fontSizeOf(leaf, cell) ?? 0) >= 20 && clean(leaf.textContent).length <= 40);
    const codeLeaf = leaves.find(isCodeElement);
    if (!big) return null;

    // The colored box around the big value is the card header (value + label).
    let header: Element | null = null;
    for (let current = big.parentElement; current && current !== cell; current = current.parentElement) {
      if (isAccent(backgroundOf(current))) {
        header = current;
        break;
      }
    }
    if (!header && !codeLeaf) return null;

    const headerLeaves = header ? leavesOf(header) : [big];
    const used = new Set<Element>([...headerLeaves, ...(codeLeaf ? [codeLeaf] : [])]);
    const label = header
      ? headerLeaves.filter((leaf) => leaf !== big).map((leaf) => plainText(leaf)).join(" · ")
      : (() => {
          const next = leaves[leaves.indexOf(big) + 1];
          if (next && next !== codeLeaf && (fontSizeOf(next, cell) ?? 14) <= 13) {
            used.add(next);
            return plainText(next);
          }
          return "";
        })();
    const text = leaves
      .filter((leaf) => !used.has(leaf) && !CODE_LABEL.test(clean(leaf.textContent)))
      .map((leaf) => inlineText(leaf))
      .filter(Boolean)
      .join("\n\n");

    promos.push({
      // Keeps the line breaks of the original ("20% off" / "+ envío gratis").
      value: truncateAtWord(stripInline(inlineText(big)).split("\n").map(clean).filter(Boolean).join("\n"), 40),
      label: label ? truncateAtWord(label, 100) : null,
      text: truncateAtWord(text, 500),
      code: codeLeaf ? clean(codeLeaf.textContent) : null,
      tone: toneOfColor(header ? backgroundOf(header) : parseColor(styleValue(codeLeaf ?? big, "color")), index % 2 === 0 ? "pink" : "cyan"),
    });
  }

  return promos;
}

// Cards with a big number and a short caption ("92%" / "de los chicos repite").
function parseStatCards(cells: Element[]): { items: NewsletterStat[]; tone: NewsletterAccentTone } | null {
  if (cells.length > 3) return null;
  const items: NewsletterStat[] = [];
  let tone: NewsletterAccentTone | null = null;
  for (const cell of cells) {
    const leaves = leavesOf(cell);
    const big = leaves.find((leaf) => (fontSizeOf(leaf, cell) ?? 0) >= 22);
    if (!big || leaves.length > 3 || leaves.some(isCodeElement) || leaves.some((leaf) => buttonLink(leaf))) return null;
    const value = plainText(big);
    const label = leaves.filter((leaf) => leaf !== big).map((leaf) => plainText(leaf)).join(" ");
    if (value.length > 16 || !/\d/.test(value) || label.length < 2) return null;
    tone ??= toneOfColor(isAccent(backgroundOf(cell)) ? backgroundOf(cell) : parseColor(styleValue(big, "color")), "cyan");
    items.push({ value, label: truncateAtWord(label, 180) });
  }
  return { items, tone: tone ?? "cyan" };
}

function parseFeatureStrip(cells: Element[]): NewsletterFeature[] | null {
  if (cells.length < 2 || cells.length > 4) return null;
  const features: NewsletterFeature[] = [];

  for (const cell of cells) {
    if (clean(cell.textContent).length > 160 || cell.querySelector("table")) return null;
    const leaves = leavesOf(cell);
    const iconLeaf = leaves.find((leaf) => isEmojiOnly(clean(leaf.textContent)));
    const rest = leaves.filter((leaf) => leaf !== iconLeaf);
    const titleLeaf = rest.find(isBold) ?? (iconLeaf ? rest[0] : undefined);
    if (!titleLeaf) return null;
    features.push({
      icon: iconLeaf ? clean(iconLeaf.textContent) : null,
      title: truncateAtWord(plainText(titleLeaf), 80),
      text: truncateAtWord(rest.filter((leaf) => leaf !== titleLeaf).map((leaf) => plainText(leaf)).join(" "), 200),
    });
  }

  return features;
}

function parseStructuredEmail(doc: Document, fileName: string): ImportedNewsletter | null {
  const body = doc.body;
  if (!body || !clean(body.textContent)) return null;
  wrapLooseText(body);

  const blocks: NewsletterBlock[] = [];
  const notes: string[] = [];
  const finePrint: string[] = [];
  let title = "";
  let category = "";
  let fixedLinks = 0;
  let skippedImages = 0;
  let lastWasParagraph = false;
  let hiddenPreheader = "";

  const push = (block: NewsletterBlock) => {
    blocks.push(block);
    lastWasParagraph = block.type === "paragraph";
  };
  const hasContent = () => blocks.some((block) => block.type !== "banner");

  const pushParagraph = (text: string) => {
    if (!text) return;
    const last = blocks.at(-1);
    if (lastWasParagraph && last?.type === "paragraph") last.text = `${last.text}\n\n${text}`;
    else push({ id: createBlockId(), type: "paragraph", text });
  };

  const isFooter = (cell: Element) => {
    const links = Array.from(cell.querySelectorAll("a"));
    const background = backgroundOf(cell);
    if (links.some((link) => UNSUBSCRIBE_TEXT.test(clean(link.textContent)) || UNSUBSCRIBE_HREF.test(link.getAttribute("href") ?? "") || WEB_VIEW_TEXT.test(clean(link.textContent)))) return true;
    // Dark closing band with the brand name, links or legal text.
    const text = plainText(cell);
    return background !== null && luminance(background) < 0.3 && hasContent() && (links.length > 0 || STORE_NAME.test(text) || /©|derechos|iqkids\.com/i.test(text));
  };

  const handleFooter = (cell: Element) => {
    for (const leaf of leavesOf(cell)) {
      for (const line of plainTextLines(leaf)) {
        if (STORE_NAME.test(line) && line.length < 40) continue;
        if (UNSUBSCRIBE_TEXT.test(line) || WEB_VIEW_TEXT.test(line) || /iqkids\.com\.ar|@iqkids|©|todos los derechos/i.test(line)) continue;
        if (line.length > 3) finePrint.push(line);
      }
    }
  };

  const handleLeaf = (element: Element) => {
    const tag = element.tagName.toLowerCase();
    const text = plainText(element);
    if (!text) return;

    // Brand header of the original ("iQ Kids · Snack saludable"): the template has the logo.
    if (!hasContent() && STORE_NAME.test(text) && text.length < 60) return;

    // Legal / unsubscribe line: the template adds its own footer.
    if (!buttonLink(element) && isFooter(element)) {
      handleFooter(element);
      return;
    }

    const button = buttonLink(element);
    if (button) {
      const href = (button.getAttribute("href") ?? "").trim();
      const { url, fixed } = storeLinkFrom(href);
      if (fixed) fixedLinks += 1;
      push({ id: createBlockId(), type: "button", label: truncateAtWord(text, 80), url, note: null, tone: toneOfColor(backgroundOf(button) ?? backgroundOf(element)) });
      return;
    }

    const size = fontSizeOf(element) ?? 15;
    const last = blocks.at(-1);

    if (/^h[1-6]$/.test(tag) || (size >= 22 && text.length <= 140)) {
      if (!title && !blocks.some((block) => block.type === "paragraph")) title = text;
      else push({ id: createBlockId(), type: "heading", text: truncateAtWord(text, 160) });
      return;
    }

    if (!title && !category && styleValue(element, "text-transform") === "uppercase" && text.length <= 80) {
      category = text;
      return;
    }

    if (last?.type === "button" && !last.note && size <= 13 && text.length <= 160) {
      last.note = text;
      lastWasParagraph = false;
      return;
    }

    if (isBold(element) && text.length <= 120 && !/[.:]$/.test(text) && hasContent()) {
      push({ id: createBlockId(), type: "heading", text: truncateAtWord(text, 160) });
      return;
    }

    pushParagraph(inlineText(element));
  };

  const visit = (element: Element) => {
    const tag = element.tagName.toLowerCase();
    if (isHiddenElement(element)) {
      if (!hiddenPreheader && clean(element.textContent)) hiddenPreheader = clean(element.textContent);
      return;
    }
    if (/^(script|style|head|title|meta|link)$/.test(tag)) return;

    if (tag === "ul" || tag === "ol") {
      const items = Array.from(element.children).filter((item) => item.tagName.toLowerCase() === "li" && clean(item.textContent));
      if (items.length > 0) {
        push({ id: createBlockId(), type: "paragraph", text: items.map((item, index) => `${tag === "ol" ? `${index + 1}.` : "•"} ${inlineText(item).replace(/\n+/g, " ")}`).join("\n") });
        lastWasParagraph = false;
        return;
      }
    }

    if (tag === "hr") {
      if (hasContent() && blocks.at(-1)?.type !== "divider") push({ id: createBlockId(), type: "divider" });
      return;
    }

    if (tag === "img") {
      const src = element.getAttribute("src") ?? "";
      const width = Number(element.getAttribute("width") ?? styleValue(element, "width")?.replace("px", "") ?? 0);
      const alt = clean(element.getAttribute("alt"));
      if (STORE_NAME.test(alt) && !hasContent()) return;
      if (width && width < 120) return;
      if (isSafeImageUrl(src)) push({ id: createBlockId(), type: "image", url: src, alt: alt.length >= 3 ? alt : title || "Imagen del newsletter", caption: null });
      else skippedImages += 1;
      return;
    }

    if (/^(td|th|div|header|footer|section|aside|center|table|tbody)$/.test(tag)) {
      const leaves = leavesOf(element);
      const text = plainText(element);
      const hasButton = leaves.some((leaf) => buttonLink(leaf));
      if (text.length < 500 && !hasButton && isFooter(element)) {
        handleFooter(element);
        return;
      }
      // Brand header of the original ("iQ Kids" + tagline): the template has its own logo.
      if (!hasContent() && leaves[0] && STORE_NAME.test(plainText(leaves[0])) && text.length < 120 && !hasButton) return;
      // Quote / testimonial box: “text” — author.
      if (leaves.length === 1 && /^["“«]/.test(text) && text.length <= 800) {
        const [quote, ...author] = text.split(/\s+[—–-]\s+/);
        const [name, ...role] = author.join(" — ").split(",");
        push({ id: createBlockId(), type: "quote", text: truncateAtWord(stripQuotes(quote ?? text), 800), author: clean(name) ? truncateAtWord(clean(name), 120) : null, role: clean(role.join(",")) ? truncateAtWord(clean(role.join(",")), 240) : null, tone: toneOfColor(isAccent(backgroundOf(element)) ? backgroundOf(element) : null) });
        return;
      }
      // Colored strip with a single short text: announcement banner.
      if (isAccent(backgroundOf(element)) && leaves.length === 1 && text.length <= 200 && !hasButton && !STORE_NAME.test(text) && !/^h[1-6]$/i.test(leaves[0]!.tagName)) {
        push({ id: createBlockId(), type: "banner", text: truncateAtWord(text.replace(/\s+/g, " "), 200), tone: toneOfColor(backgroundOf(element)) });
        return;
      }
    }

    // A row: table row, or (after layout normalization) any element whose children sit side by side.
    if (tag === "tr" || element.hasAttribute("data-iq-row")) {
      const cells = contentCells(element);
      if (cells.length === 2 && (soleImage(cells[0]!) || soleImage(cells[1]!)) && !(soleImage(cells[0]!) && soleImage(cells[1]!))) {
        const imageFirst = Boolean(soleImage(cells[0]!));
        const image = soleImage(imageFirst ? cells[0]! : cells[1]!)!;
        const textCell = imageFirst ? cells[1]! : cells[0]!;
        const leaves = leavesOf(textCell);
        const titleLeaf = leaves[0] && (isBold(leaves[0]) || /^h[1-6]$/i.test(leaves[0].tagName)) && leaves.length > 1 ? leaves[0] : null;
        const text = leaves.filter((leaf) => leaf !== titleLeaf && !buttonLink(leaf)).map((leaf) => inlineText(leaf)).filter(Boolean).join("\n\n");
        if (text) {
          const alt = clean(image.getAttribute("alt"));
          push({ id: createBlockId(), type: "imageText", url: image.getAttribute("src") ?? "", alt: alt.length >= 3 ? alt : plainText(titleLeaf) || "Imagen del newsletter", title: titleLeaf ? truncateAtWord(plainText(titleLeaf), 160) : null, text: truncateAtWord(text, 3000), imagePosition: imageFirst ? "left" : "right" });
          leaves.filter((leaf) => buttonLink(leaf)).forEach(handleLeaf);
          return;
        }
      }
      if (cells.length >= 2 && cells.length <= 4) {
        // Cards with their own buttons are read cell by cell so no link is lost.
        const sameKind = cells.every((cell) => !soleImage(cell)) && !cells.some((cell) => leavesOf(cell).some((leaf) => buttonLink(leaf)));
        const promos = sameKind ? parsePromoCards(cells) : null;
        if (promos) {
          push({ id: createBlockId(), type: "promos", items: promos.slice(0, 3) });
          return;
        }
        const stats = sameKind ? parseStatCards(cells) : null;
        if (stats) {
          push({ id: createBlockId(), type: "stats", items: stats.items, tone: stats.tone });
          return;
        }
        const features = sameKind ? parseFeatureStrip(cells) : null;
        if (features) {
          push({ id: createBlockId(), type: "features", items: features });
          return;
        }
      }
      if (cells.length >= 2 && cells.every((cell) => soleImage(cell))) {
        const images = cells.slice(0, 3).map((cell) => soleImage(cell)!);
        push({ id: createBlockId(), type: "gallery", images: images.map((image) => ({ url: image.getAttribute("src") ?? "", alt: clean(image.getAttribute("alt")).length >= 3 ? clean(image.getAttribute("alt")) : "Imagen del newsletter" })), caption: null });
        return;
      }
    }

    if (!hasContainerChild(element)) {
      handleLeaf(element);
      return;
    }

    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        const loose = clean(node.textContent);
        if (loose) pushParagraph(loose);
      } else if (node instanceof Element) {
        visit(node);
      }
    }
  };

  visit(body);

  if (finePrint.length > 0) push({ id: createBlockId(), type: "paragraph", text: truncateAtWord(finePrint.join("\n"), 5000), small: true });

  // Too little of the original made it into blocks: not a structure we understand.
  const sourceLength = clean(body.textContent).length;
  const keptLength = [title, category, ...blocks.map(getBlockPlainText), ...blocks.flatMap((block) => (block.type === "button" ? [block.label, block.note ?? ""] : []))].join(" ").length;
  if (blocks.length === 0 || keptLength < sourceLength * 0.6) return null;

  const headline = title;
  const subject = commentValue(doc, /subject|asunto/) || clean(doc.title) || headline;
  const preheader = commentValue(doc, /preheader|preview|pre-header|vista previa/) || hiddenPreheader;
  const firstParagraph = blocks.find((block) => block.type === "paragraph");
  const firstText = firstParagraph?.type === "paragraph" ? stripInline(firstParagraph.text.split("\n\n")[0] ?? "").replace(/\n/g, " ") : "";
  const finalTitle = truncateAtWord(headline || subject || fileName, 140);

  notes.push(`Importada de ${fileName}: se tomó la estructura y los textos del email y se armó con los bloques y la marca de IQ Kids (colores, tipografías, logo y pie).`);
  if (fixedLinks > 0) notes.push(`${fixedLinks === 1 ? "Un botón apuntaba" : `${fixedLinks} botones apuntaban`} a una página que no existe (/products o "#"): se puso ${DEFAULT_BUTTON_URL}. Revisar.`);
  if (skippedImages > 0) notes.push(`${skippedImages === 1 ? "Una imagen no tenía" : `${skippedImages} imágenes no tenían`} una dirección https y no se importaron: subilas con un bloque de imagen.`);

  return {
    sourceLabel: fileName,
    internalNotes: notes.join("\n\n").slice(0, 5000),
    content: {
      title: finalTitle,
      subtitle: null,
      excerpt: truncateAtWord((preheader || firstText).length >= 10 ? preheader || firstText : finalTitle, 400),
      category: category ? truncateAtWord(category, 60) : null,
      headerTag: null,
      coverImageUrl: null,
      coverImageAlt: null,
      blocks: blocks.slice(0, 60),
      emailSubject: truncateAtWord(subject || finalTitle, 120),
      emailPreviewText: preheader ? truncateAtWord(preheader, 150) : firstText ? firstSentence(firstText, 150) : null,
    },
  };
}

function plainTextLines(element: Element) {
  return stripInline(inlineText(element))
    .split("\n")
    .map((line) => clean(line).replace(/^[·•|\s]+|[·•|\s]+$/g, ""))
    .filter(Boolean);
}

// Renders the email in an invisible, script-less iframe and writes the styles the
// browser actually computed (from <style> classes, inherited fonts, defaults) as
// inline styles, and marks elements whose children sit side by side (cards in a row,
// flex or grid layouts). The structure reader then works the same for table emails
// with inline styles and for div/class based HTML (e.g. generated by an AI assistant).
async function normalizeWithLayout(html: string): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-same-origin");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:640px;height:900px;border:0;visibility:hidden;";
  document.body.appendChild(frame);

  try {
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 4000);
      frame.addEventListener("load", () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
      frame.srcdoc = html;
    });

    const doc = frame.contentDocument;
    const view = frame.contentWindow;
    if (!doc?.body || !view) return null;

    const elements = Array.from(doc.body.querySelectorAll("*"));
    const updates = elements.map((element) => {
      const computed = view.getComputedStyle(element);
      const props: string[] = [];
      const blockLevel = /^(block|flex|grid|list-item|table|table-row|table-cell|flow-root)$/.test(computed.display);
      if (computed.display === "none" || computed.visibility === "hidden" || element.closest("[hidden]")) props.push("display:none");
      else if (computed.display === "inline-block") props.push("display:inline-block");
      props.push(`font-size:${computed.fontSize}`, `font-weight:${computed.fontWeight}`, `font-family:${computed.fontFamily.replace(/"/g, "'")}`, `color:${computed.color}`);
      if (computed.textTransform === "uppercase") props.push("text-transform:uppercase");
      const background = parseColor(computed.backgroundColor);
      const alpha = Number(computed.backgroundColor.match(/rgba\([^)]*,\s*([\d.]+)\)/)?.[1] ?? 1);
      if (background && alpha > 0.5) props.push(`background-color:${computed.backgroundColor}`);
      const borders = [computed.borderTopStyle, computed.borderRightStyle, computed.borderBottomStyle, computed.borderLeftStyle];
      if (borders.includes("dashed") || borders.includes("dotted")) props.push("border-style:dashed");
      if (parseFloat(computed.paddingTop) + parseFloat(computed.paddingLeft) > 6) props.push(`padding:${computed.paddingTop} ${computed.paddingLeft}`);
      if (element.tagName.toLowerCase() === "img") props.push(`width:${Math.round(element.getBoundingClientRect().width)}px`);

      // Children laid out horizontally (same row, different columns).
      // Only boxes count (inline words like <strong> or <a> in a sentence never make a row).
      const children = Array.from(element.children).filter((child) => {
        const rect = child.getBoundingClientRect();
        const display = view.getComputedStyle(child).display;
        return rect.width > 0 && rect.height > 0 && display !== "inline" && display !== "contents" && display !== "none";
      });
      let row = false;
      if (children.length >= 2 && blockLevel && element.tagName.toLowerCase() !== "tr") {
        const rects = children.map((child) => child.getBoundingClientRect());
        const top = rects[0]!.top;
        row = rects.every((rect, index) => Math.abs(rect.top - top) < 24 && (index === 0 || rect.left >= rects[index - 1]!.right - 2));
      }
      return { element, style: props.join(";"), row, blockLevel };
    });

    for (const { element, style, row, blockLevel } of updates) {
      element.setAttribute("style", style);
      if (row) element.setAttribute("data-iq-row", "");
      if (blockLevel && !/^(br|img)$/i.test(element.tagName)) element.setAttribute("data-iq-block", "");
    }

    return `<!doctype html>${doc.documentElement.outerHTML}`;
  } catch {
    return null;
  } finally {
    frame.remove();
  }
}

// Entry point for the admin import dialog: known agency formats are read as before;
// any other email is normalized with the browser's layout and rebuilt with brand blocks.
export async function importNewsletterHtml(html: string, fileName = "archivo HTML"): Promise<ImportedNewsletter[]> {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const knownFormat = doc.querySelector(".email-view, .email-card, .email-section");
  const layoutHtml = knownFormat ? null : await normalizeWithLayout(html);
  return parseNewsletterSequenceHtml(html, fileName, layoutHtml);
}

export function parseNewsletterSequenceHtml(html: string, fileName = "archivo HTML", layoutHtml: string | null = null): ImportedNewsletter[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const views = Array.from(doc.querySelectorAll(".email-view"));
  const candidates = views.length > 0 ? views : Array.from(doc.querySelectorAll(".email-card")).map((card) => card.parentElement ?? card);

  if (candidates.length > 0) {
    return candidates.map(parseView).filter((item): item is ImportedNewsletter => item !== null);
  }

  // Preview format: tabs (`.tab-btn`) label each `.email-section` in order.
  const tabLabels = Array.from(doc.querySelectorAll(".tab-btn")).map((tab) => clean(tab.textContent));
  const sections = Array.from(doc.querySelectorAll(".email-section"));

  if (sections.length > 0) {
    return sections.map((section, index) => parsePreviewSection(section, index, tabLabels)).filter((item): item is ImportedNewsletter => item !== null);
  }

  // Anything else is one ready-made email: its structure is rebuilt with the brand
  // blocks. If the structure is not understood, the design is kept as authored.
  const structured = parseStructuredEmail(new DOMParser().parseFromString(layoutHtml ?? html, "text/html"), fileName);
  if (structured) return [structured];
  const email = parseStandaloneEmail(doc, fileName);
  return email ? [email] : [];
}
