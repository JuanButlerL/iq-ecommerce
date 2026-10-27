// Pure newsletter content helpers. No imports on purpose: this module runs in the
// admin browser (live preview), on the server and inside the isolated node tests.

export const NEWSLETTER_TIP_TONES = ["pink", "yellow", "cyan", "mint"] as const;
export type NewsletterTipTone = (typeof NEWSLETTER_TIP_TONES)[number];

export const NEWSLETTER_ACCENT_TONES = ["pink", "cyan"] as const;
export type NewsletterAccentTone = (typeof NEWSLETTER_ACCENT_TONES)[number];

export const NEWSLETTER_STEP_MARKERS = ["number", "check", "cross"] as const;
export type NewsletterStepMarker = (typeof NEWSLETTER_STEP_MARKERS)[number];

export type NewsletterImage = { url: string; alt: string };
export type NewsletterStat = { value: string; label: string };
export type NewsletterStep = { title: string; text: string; marker: NewsletterStepMarker };

export type NewsletterBlock =
  | { id: string; type: "heading"; text: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "image"; url: string; alt: string; caption?: string | null }
  | { id: string; type: "imageText"; url: string; alt: string; title?: string | null; text: string; imagePosition: "left" | "right" }
  | { id: string; type: "gallery"; images: NewsletterImage[]; caption?: string | null }
  | { id: string; type: "quote"; text: string; author?: string | null; role?: string | null; tone?: NewsletterAccentTone }
  | { id: string; type: "button"; label: string; url: string; note?: string | null; tone?: NewsletterAccentTone }
  | { id: string; type: "product"; productId: string; note?: string | null }
  | { id: string; type: "tip"; title?: string | null; text: string; tone: NewsletterTipTone }
  | { id: string; type: "stats"; items: NewsletterStat[]; tone: NewsletterAccentTone }
  | { id: string; type: "steps"; items: NewsletterStep[]; tone: NewsletterAccentTone }
  | { id: string; type: "testimonial"; quote: string; author: string; detail?: string | null; imageUrl?: string | null; imageAlt?: string | null }
  | { id: string; type: "sources"; label: string; text: string }
  | { id: string; type: "divider" };

export type NewsletterBlockType = NewsletterBlock["type"];

export type NewsletterContent = {
  slug: string;
  title: string;
  subtitle?: string | null;
  excerpt: string;
  category?: string | null;
  headerTag?: string | null;
  coverImageUrl?: string | null;
  coverImageAlt?: string | null;
  blocks: NewsletterBlock[];
  emailSubject: string;
  emailPreviewText?: string | null;
};

export type NewsletterProductSummary = {
  id: string;
  name: string;
  slug: string;
  priceArs: number;
  imageUrl: string | null;
  available: boolean;
};

export const NEWSLETTER_BLOCK_LABELS: Record<NewsletterBlockType, string> = {
  heading: "Título de sección",
  paragraph: "Párrafo",
  image: "Imagen",
  imageText: "Imagen + texto",
  gallery: "Galería",
  quote: "Cita",
  button: "Botón",
  product: "Producto destacado",
  tip: "Caja destacada",
  stats: "Datos",
  steps: "Lista de pasos",
  testimonial: "Testimonio",
  sources: "Fuentes",
  divider: "Separador",
};

export const NEWSLETTER_ACCENT_TONE_LABELS: Record<NewsletterAccentTone, string> = {
  pink: "Rosa",
  cyan: "Celeste",
};

export const NEWSLETTER_STEP_MARKER_LABELS: Record<NewsletterStepMarker, string> = {
  number: "Número",
  check: "✓ Sí",
  cross: "✗ No",
};

export const NEWSLETTER_TIP_TONE_LABELS: Record<NewsletterTipTone, string> = {
  pink: "Rosa",
  yellow: "Amarillo",
  cyan: "Celeste",
  mint: "Verde menta",
};

export function createBlockId() {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyBlock(type: NewsletterBlockType): NewsletterBlock {
  const id = createBlockId();

  switch (type) {
    case "heading":
      return { id, type, text: "" };
    case "paragraph":
      return { id, type, text: "" };
    case "image":
      return { id, type, url: "", alt: "", caption: "" };
    case "imageText":
      return { id, type, url: "", alt: "", title: "", text: "", imagePosition: "left" };
    case "gallery":
      return { id, type, images: [{ url: "", alt: "" }, { url: "", alt: "" }], caption: "" };
    case "quote":
      return { id, type, text: "", author: "", role: "", tone: "pink" };
    case "button":
      return { id, type, label: "", url: "", note: "", tone: "pink" };
    case "product":
      return { id, type, productId: "", note: "" };
    case "tip":
      return { id, type, title: "", text: "", tone: "pink" };
    case "stats":
      return { id, type, items: [{ value: "", label: "" }, { value: "", label: "" }], tone: "cyan" };
    case "steps":
      return { id, type, items: [{ title: "", text: "", marker: "number" }, { title: "", text: "", marker: "number" }], tone: "pink" };
    case "testimonial":
      return { id, type, quote: "", author: "", detail: "", imageUrl: "", imageAlt: "" };
    case "sources":
      return { id, type, label: "Fuentes", text: "" };
    case "divider":
      return { id, type };
  }
}

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

// Links: https, http, mailto or site-relative paths. Never javascript:, data:, etc.
export function isSafeLinkUrl(value: string) {
  const url = value.trim();

  if (!url || /\s/.test(url)) {
    return false;
  }

  if (url.startsWith("/")) {
    return !url.startsWith("//");
  }

  return /^(https?:\/\/[^/\s]+|mailto:[^\s@]+@[^\s@]+)/i.test(url);
}

// Images: uploaded files are either https (storage) or site-relative (/uploads/...).
export function isSafeImageUrl(value: string) {
  const url = value.trim();

  if (!url || /\s/.test(url)) {
    return false;
  }

  if (url.startsWith("/")) {
    return !url.startsWith("//");
  }

  return /^https:\/\/[^/\s]+\//i.test(url);
}

export function toAbsoluteUrl(url: string, siteUrl: string) {
  if (url.startsWith("/")) {
    return `${siteUrl.replace(/\/$/, "")}${url}`;
  }

  return url;
}

// Adds newsletter UTMs only to links that point to our own site.
export function withNewsletterUtm(url: string, siteUrl: string, slug: string) {
  const absolute = toAbsoluteUrl(url, siteUrl);

  try {
    const target = new URL(absolute);
    const site = new URL(siteUrl);

    if (target.host !== site.host || target.searchParams.has("utm_source")) {
      return absolute;
    }

    target.searchParams.set("utm_source", "newsletter");
    target.searchParams.set("utm_medium", "email");
    target.searchParams.set("utm_campaign", slug);

    return target.toString();
  } catch {
    return absolute;
  }
}

// ---------------------------------------------------------------------------
// Inline formatting: **bold**, *italic* and [label](url). Everything else is text.
// ---------------------------------------------------------------------------

export type InlineToken =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "link"; text: string; url: string };

const inlinePattern = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

export function parseInline(value: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(inlinePattern)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      tokens.push({ type: "text", text: value.slice(lastIndex, index) });
    }

    if (match[1] !== undefined) {
      tokens.push({ type: "bold", text: match[1] });
    } else if (match[2] !== undefined) {
      tokens.push({ type: "italic", text: match[2] });
    } else if (match[3] !== undefined && match[4] !== undefined) {
      tokens.push(
        isSafeLinkUrl(match[4])
          ? { type: "link", text: match[3], url: match[4] }
          : { type: "text", text: match[3] },
      );
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < value.length) {
    tokens.push({ type: "text", text: value.slice(lastIndex) });
  }

  return tokens;
}

export function stripInline(value: string) {
  return parseInline(value)
    .map((token) => token.text)
    .join("");
}

// Links written inside text blocks, in document order.
export function extractInlineLinks(value: string) {
  return parseInline(value).flatMap((token) => (token.type === "link" ? [token.url] : []));
}

export function splitParagraphs(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function containsHtml(value: string) {
  return /<\/?[a-z][^>]*>/i.test(value);
}

// ---------------------------------------------------------------------------
// Derived data
// ---------------------------------------------------------------------------

export function slugifyNewsletter(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function getBlockPlainText(block: NewsletterBlock) {
  switch (block.type) {
    case "heading":
      return block.text;
    case "paragraph":
      return stripInline(block.text);
    case "imageText":
      return `${block.title ?? ""} ${stripInline(block.text)}`;
    case "quote":
      return `${block.text} ${block.author ?? ""}`;
    case "tip":
      return `${block.title ?? ""} ${stripInline(block.text)}`;
    case "stats":
      return block.items.map((item) => `${item.value} ${item.label}`).join(" ");
    case "steps":
      return block.items.map((item) => `${item.title} ${stripInline(item.text)}`).join(" ");
    case "testimonial":
      return `${block.quote} ${block.author}`;
    case "sources":
      return stripInline(block.text);
    case "image":
      return block.caption ?? "";
    case "gallery":
      return block.caption ?? "";
    case "product":
      return block.note ?? "";
    default:
      return "";
  }
}

export function estimateReadingMinutes(content: Pick<NewsletterContent, "title" | "subtitle" | "excerpt" | "blocks">) {
  const text = [content.title, content.subtitle ?? "", content.excerpt, ...content.blocks.map(getBlockPlainText)].join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;

  return Math.max(1, Math.round(words / 200));
}

export function getBlockImages(block: NewsletterBlock): NewsletterImage[] {
  if (block.type === "image" || block.type === "imageText") {
    return [{ url: block.url, alt: block.alt }];
  }

  if (block.type === "gallery") {
    return block.images;
  }

  if (block.type === "testimonial" && block.imageUrl) {
    return [{ url: block.imageUrl, alt: block.imageAlt ?? "" }];
  }

  return [];
}

// Stable, dependency-free hash (cyrb53). Used to detect edits after a test send,
// not for security.
function cyrb53(value: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

// Canonical form for hashing. PostgreSQL JSONB does not keep object key order and
// validation turns "" into null and trims text, so the hash must ignore key order,
// surrounding whitespace and empty values. Otherwise the editor would always see
// "unsaved changes" and a test send would never match the saved content.
function canonicalize(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }

  if (value === null || value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item) ?? null);
  }

  if (typeof value === "object") {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, canonicalize((value as Record<string, unknown>)[key])] as const)
      .filter(([, item]) => item !== undefined);
    return Object.fromEntries(entries);
  }

  return value;
}

export function computeNewsletterContentHash(content: NewsletterContent) {
  return cyrb53(
    JSON.stringify(
      canonicalize({
        slug: content.slug,
        title: content.title,
        subtitle: content.subtitle,
        excerpt: content.excerpt,
        category: content.category,
        headerTag: content.headerTag,
        coverImageUrl: content.coverImageUrl,
        coverImageAlt: content.coverImageAlt,
        blocks: content.blocks,
        emailSubject: content.emailSubject,
        emailPreviewText: content.emailPreviewText,
      }),
    ),
  );
}

// `optional` items are recommendations: shown in the checklist but never block sending.
export type NewsletterChecklistItem = { id: string; label: string; ok: boolean; optional?: boolean };

export function getNewsletterChecklist(
  content: NewsletterContent,
  options: { contentHash: string; lastTestContentHash?: string | null; testRecipientsCount: number },
): NewsletterChecklistItem[] {
  const images = content.blocks.flatMap(getBlockImages);

  return [
    { id: "title", label: "Título y resumen completos", ok: content.title.trim().length >= 3 && content.excerpt.trim().length >= 10 },
    {
      id: "cover",
      label: "Portada con texto alternativo (recomendado)",
      ok: Boolean(content.coverImageUrl?.trim()) && (content.coverImageAlt?.trim().length ?? 0) >= 3,
      optional: true,
    },
    { id: "subject", label: "Asunto del mail (hasta 120 caracteres)", ok: content.emailSubject.trim().length >= 3 && content.emailSubject.length <= 120 },
    { id: "preview", label: "Texto de vista previa del mail", ok: (content.emailPreviewText?.trim().length ?? 0) >= 10 },
    { id: "blocks", label: "Al menos un bloque de contenido", ok: content.blocks.length > 0 },
    {
      id: "images",
      label: "Todas las imágenes cargadas y con texto alternativo",
      ok: images.every((image) => isSafeImageUrl(image.url) && image.alt.trim().length >= 3),
    },
    { id: "test-recipients", label: "Casillas de prueba configuradas", ok: options.testRecipientsCount > 0 },
    {
      id: "test",
      label: "Prueba enviada con la versión actual",
      ok: Boolean(options.lastTestContentHash) && options.lastTestContentHash === options.contentHash,
    },
  ];
}
