import { createBlockId, isSafeLinkUrl, stripInline, type NewsletterBlock, type NewsletterContent, type NewsletterStepMarker } from "@/features/newsletter/content";

// Converts the "newsletter sequence" HTML format (one `.email-view` per email, with
// `.email-body` blocks such as `.stat-row`, `.system-list`, `.testi-card`) into
// editable newsletter drafts. Runs in the admin browser with DOMParser. It never
// keeps raw HTML: everything becomes validated blocks. Unknown elements degrade to
// plain paragraphs and suggested photos / implementation notes go to internal notes.

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
  return element ? Array.from(element.childNodes).map(toInline).join("").replace(/[ \t]+/g, " ").trim() : "";
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

export function parseNewsletterSequenceHtml(html: string): ImportedNewsletter[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const views = Array.from(doc.querySelectorAll(".email-view"));
  const candidates = views.length > 0 ? views : Array.from(doc.querySelectorAll(".email-card")).map((card) => card.parentElement ?? card);

  return candidates.map(parseView).filter((item): item is ImportedNewsletter => item !== null);
}
