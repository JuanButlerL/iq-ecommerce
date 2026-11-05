import { createBlockId, isSafeImageUrl, isSafeLinkUrl, stripInline, type NewsletterBlock, type NewsletterContent, type NewsletterStepMarker } from "@/features/newsletter/content";
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
      for (const card of Array.from(element.querySelectorAll(".promo-card"))) {
        const header = card.querySelector(".promo-card-header");
        const cardTitle = [plainText(card.querySelector(".promo-card-title")), plainText(card.querySelector(".promo-card-tag"))].filter(Boolean).join(" · ");
        const code = plainText(card.querySelector(".promo-code"));
        const text = [inlineText(card.querySelector(".promo-card-desc")), code ? `Código: **${code}**` : ""].filter(Boolean).join("\n\n");
        if (text) push({ id: createBlockId(), type: "tip", title: cardTitle ? truncateAtWord(cardTitle, 120) : null, tone: header?.classList.contains("teal") ? "cyan" : "pink", text });
      }
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

export function parseNewsletterSequenceHtml(html: string, fileName = "archivo HTML"): ImportedNewsletter[] {
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

  // Anything else is one ready-made email.
  const email = parseStandaloneEmail(doc, fileName);
  return email ? [email] : [];
}
