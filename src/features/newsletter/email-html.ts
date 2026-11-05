import { isSafeImageUrl, isSafeLinkUrl } from "@/features/newsletter/content";

// Allowlist sanitizer for imported email HTML ("HTML de email" block). It keeps what
// email designs are built with (nested tables, inline styles, width / cellpadding /
// align / bgcolor attributes, emojis) and rebuilds the markup from scratch: every
// tag, attribute and text node is re-serialized, so nothing from the source reaches
// the output unescaped. Scripts, forms, iframes, event handlers, javascript:/data:
// URLs and CSS expressions are dropped. It is idempotent (sanitizing twice gives the
// same string) so the content hash stays stable between the browser and the server.
//
// Pure TypeScript with no DOM: runs in the admin browser, on the server (validation
// and email rendering) and inside the isolated node tests.

// Special link targets set by the importer: "Desuscribirse" and "Ver en el navegador"
// links of the original email become the newsletter's own unsubscribe / web links.
export const EMAIL_HTML_UNSUBSCRIBE_HREF = "nl:unsubscribe";
export const EMAIL_HTML_WEB_HREF = "nl:web";

export const EMAIL_HTML_MAX_LENGTH = 300_000;
export const EMAIL_CSS_MAX_LENGTH = 30_000;

const ALLOWED_TAGS = new Set([
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col",
  "div", "span", "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6",
  "a", "img", "strong", "b", "em", "i", "u", "s", "strike", "del", "ins", "small", "big", "sup", "sub", "mark",
  "center", "font", "ul", "ol", "li", "dl", "dt", "dd", "blockquote", "pre", "code",
  "section", "article", "header", "footer", "main", "aside", "nav", "figure", "figcaption",
]);

const VOID_TAGS = new Set(["br", "hr", "img", "col", "wbr"]);

// Dropped together with everything inside them.
const DROP_WITH_CONTENT = new Set([
  "script", "style", "title", "textarea", "select", "option", "iframe", "frame", "frameset", "object", "embed", "applet",
  "noscript", "noembed", "noframes", "template", "svg", "math", "xmp", "plaintext", "head", "video", "audio", "canvas", "map", "button",
]);

// Their content is raw text up to the closing tag (never parsed as markup).
const RAW_TEXT = new Set(["script", "style", "title", "textarea", "iframe", "noscript", "noembed", "noframes", "xmp", "plaintext", "template"]);

const BLOCK_TAGS = new Set(["p", "div", "tr", "table", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ul", "ol", "blockquote", "pre", "center", "section", "article", "header", "footer", "main", "aside", "figure", "figcaption", "dl", "dt", "dd", "hr", "caption"]);

const SIZE = /^\d{1,4}(\.\d{1,2})?(%|px)?$/i;
const COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,20}|rgba?\([\d\s.,%]+\))$/i;

const ATTRIBUTE_RULES: Record<string, (value: string) => string | null> = {
  width: (v) => (SIZE.test(v) ? v : null),
  height: (v) => (SIZE.test(v) ? v : null),
  border: (v) => (/^\d{1,2}$/.test(v) ? v : null),
  cellpadding: (v) => (/^\d{1,3}$/.test(v) ? v : null),
  cellspacing: (v) => (/^\d{1,3}$/.test(v) ? v : null),
  colspan: (v) => (/^\d{1,3}$/.test(v) ? v : null),
  rowspan: (v) => (/^\d{1,3}$/.test(v) ? v : null),
  align: (v) => (/^(left|right|center|justify)$/i.test(v) ? v.toLowerCase() : null),
  valign: (v) => (/^(top|middle|bottom|baseline)$/i.test(v) ? v.toLowerCase() : null),
  bgcolor: (v) => (COLOR.test(v) ? v : null),
  color: (v) => (COLOR.test(v) ? v : null),
  face: (v) => (/^[\w\s,'-]{1,200}$/.test(v) ? v : null),
  size: (v) => (/^[+-]?\d$/.test(v) ? v : null),
  dir: (v) => (/^(ltr|rtl|auto)$/i.test(v) ? v.toLowerCase() : null),
  lang: (v) => (/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/i.test(v) ? v : null),
  role: (v) => (/^(presentation|none|article|banner|img|heading|list|listitem)$/i.test(v) ? v.toLowerCase() : null),
  class: (v) => (/^[\w\s-]{1,300}$/.test(v) ? v.trim().replace(/\s+/g, " ") : null),
  title: (v) => v.slice(0, 300),
  alt: (v) => v.slice(0, 300),
  nowrap: () => "nowrap",
  "aria-hidden": (v) => (/^(true|false)$/i.test(v) ? v.toLowerCase() : null),
};

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", colon: ":", sol: "/", tab: "\t", newline: "\n", lpar: "(", rpar: ")", bsol: "\\", semi: ";", period: "." };

export function decodeEntities(value: string) {
  return value.replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]{2,10});?/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    const named = NAMED_ENTITIES[entity.toLowerCase()];
    return named ?? match;
  });
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Text keeps valid entities (&nbsp;, &copy;, &#127881;) as written, escapes everything else.
function escapeText(value: string) {
  return value
    .replace(/&(?!(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});)/gi, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isSafeCssUrl(raw: string) {
  const url = raw.trim().replace(/^['"]|['"]$/g, "").trim();
  return isSafeImageUrl(url);
}

// One inline style attribute. Unsafe declarations are dropped one by one, so a single
// odd property never costs the whole design.
export function sanitizeInlineStyle(raw: string) {
  const value = decodeEntities(raw).replace(/\/\*[\s\S]*?\*\//g, "");
  const declarations: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";

  for (const char of value) {
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
    } else if (char === ";" && depth === 0) {
      declarations.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  declarations.push(current);

  const kept: string[] = [];
  for (const declaration of declarations) {
    const colon = declaration.indexOf(":");
    if (colon < 0) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const propertyValue = declaration.slice(colon + 1).trim().replace(/\s+/g, " ");
    if (!/^-?[a-z][a-z-]{0,40}$/.test(property) || !propertyValue || propertyValue.length > 500) continue;
    if (/[\\<>{}]|expression\s*\(|javascript:|vbscript:|behavior|binding|@import/i.test(propertyValue) || property === "behavior" || property.endsWith("binding")) continue;
    if (property === "position" && /fixed|sticky/i.test(propertyValue)) continue;
    const urls = [...propertyValue.matchAll(/url\(([^)]*)\)/gi)];
    if (urls.some((match) => !isSafeCssUrl(match[1] ?? ""))) continue;
    kept.push(`${property}:${propertyValue}`);
  }

  return kept.join(";");
}

// Contents of the email's <style> tags (media queries for mobile, resets). Kept only
// for the email and for the isolated web frame, never injected into the site's page.
export function sanitizeEmailCss(raw: string | null | undefined) {
  if (!raw) return "";
  let css = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--|-->/g, "");
  if (/[<>\\]|expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding/i.test(css)) {
    css = css.replace(/[<>\\]/g, "").replace(/expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding/gi, "x-blocked(");
  }
  css = css
    .replace(/@import[^;]*;?/gi, "")
    .replace(/url\(([^)]*)\)/gi, (match, url: string) => (isSafeCssUrl(url) ? match : "none"))
    .replace(/position\s*:\s*(fixed|sticky)/gi, "position:static");
  return css.trim().slice(0, EMAIL_CSS_MAX_LENGTH);
}

type Attribute = { name: string; value: string };

function parseAttributes(source: string): Attribute[] {
  const attributes: Attribute[] = [];
  const pattern = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    attributes.push({ name: (match[1] ?? "").toLowerCase(), value: match[2] ?? match[3] ?? match[4] ?? "" });
  }
  return attributes;
}

// Index of the ">" that closes a tag starting at `from`, skipping quoted values.
function findTagEnd(html: string, from: number) {
  let quote: string | null = null;
  for (let index = from; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return index;
    }
  }
  return -1;
}

export type EmailHtmlLinkRewrite = (href: string) => string | null;

type WalkOptions = {
  // Receives each kept link (decoded). Returns the href to write (it is escaped), or
  // null to keep the text without a link.
  rewriteHref?: EmailHtmlLinkRewrite;
  // Called with each image src (decoded). Returns the src to write.
  rewriteSrc?: (src: string) => string;
};

function walk(input: string, options: WalkOptions = {}) {
  const html = input.slice(0, EMAIL_HTML_MAX_LENGTH * 2);
  const out: string[] = [];
  const text: string[] = [];
  const stack: string[] = [];
  const anchors: Array<{ href: string | null; textStart: number }> = [];
  let index = 0;

  const isSafeHref = (href: string) => href === EMAIL_HTML_UNSUBSCRIBE_HREF || href === EMAIL_HTML_WEB_HREF || isSafeLinkUrl(href);

  const openTag = (tag: string, attributes: Attribute[], selfClosing: boolean) => {
    const parts: string[] = [];
    let href: string | null = null;
    const seen = new Set<string>();

    for (const { name, value } of attributes) {
      if (seen.has(name)) continue;
      seen.add(name);
      const decoded = decodeEntities(value).trim();

      if (name === "style") {
        const style = sanitizeInlineStyle(value);
        if (style) parts.push(`style="${escapeAttribute(style)}"`);
      } else if (name === "href" && tag === "a") {
        if (decoded && decoded !== "#" && isSafeHref(decoded)) {
          const rewritten = options.rewriteHref ? options.rewriteHref(decoded) : decoded;
          if (rewritten) {
            href = rewritten;
            parts.push(`href="${escapeAttribute(rewritten)}"`);
          }
        }
      } else if (name === "src" && tag === "img") {
        if (isSafeImageUrl(decoded)) parts.push(`src="${escapeAttribute(options.rewriteSrc ? options.rewriteSrc(decoded) : decoded)}"`);
      } else if (name === "background" && (tag === "table" || tag === "td" || tag === "th")) {
        if (isSafeImageUrl(decoded)) parts.push(`background="${escapeAttribute(options.rewriteSrc ? options.rewriteSrc(decoded) : decoded)}"`);
      } else if (ATTRIBUTE_RULES[name]) {
        const kept = ATTRIBUTE_RULES[name](decoded);
        if (kept !== null) parts.push(name === "nowrap" ? "nowrap" : `${name}="${escapeAttribute(kept)}"`);
      }
    }

    if (tag === "img" && !parts.some((part) => part.startsWith("src="))) return;
    if (tag === "img" && !parts.some((part) => part.startsWith("alt="))) parts.push('alt=""');

    out.push(`<${tag}${parts.length ? ` ${parts.join(" ")}` : ""}>`);

    if (tag === "br") text.push("\n");
    else if (BLOCK_TAGS.has(tag)) text.push("\n");
    else if (tag === "td" || tag === "th") text.push(" ");
    if (tag === "img") {
      const alt = attributes.find((attribute) => attribute.name === "alt")?.value;
      if (alt) text.push(decodeEntities(alt));
    }

    if (!VOID_TAGS.has(tag) && !selfClosing) {
      stack.push(tag);
      if (tag === "a") anchors.push({ href, textStart: text.length });
    } else if (!VOID_TAGS.has(tag)) {
      out.push(`</${tag}>`);
    }
  };

  const closeTag = (tag: string) => {
    out.push(`</${tag}>`);
    if (tag === "a") {
      const anchor = anchors.pop();
      if (anchor?.href) {
        const label = text.slice(anchor.textStart).join("").trim();
        if (label !== anchor.href) text.push(` (${anchor.href})`);
      }
    }
    if (BLOCK_TAGS.has(tag) || tag === "td" || tag === "th") text.push(tag === "td" || tag === "th" ? " " : "\n");
  };

  while (index < html.length) {
    const lt = html.indexOf("<", index);

    if (lt < 0) {
      out.push(escapeText(html.slice(index)));
      text.push(decodeEntities(html.slice(index)));
      break;
    }

    if (lt > index) {
      out.push(escapeText(html.slice(index, lt)));
      text.push(decodeEntities(html.slice(index, lt)));
    }

    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      index = end < 0 ? html.length : end + 3;
      continue;
    }

    const next = html[lt + 1] ?? "";

    if (next === "!" || next === "?") {
      const end = html.indexOf(">", lt);
      index = end < 0 ? html.length : end + 1;
      continue;
    }

    if (next === "/") {
      const end = html.indexOf(">", lt);
      const name = html.slice(lt + 2, end < 0 ? html.length : end).trim().split(/[\s/]/)[0]?.toLowerCase() ?? "";
      index = end < 0 ? html.length : end + 1;
      const position = stack.lastIndexOf(name);
      if (position >= 0) {
        while (stack.length > position) closeTag(stack.pop() as string);
      }
      continue;
    }

    if (!/[a-z]/i.test(next)) {
      out.push("&lt;");
      text.push("<");
      index = lt + 1;
      continue;
    }

    const end = findTagEnd(html, lt + 1);
    if (end < 0) break;
    const inner = html.slice(lt + 1, end);
    const name = (inner.match(/^[a-z][a-z0-9-]*/i)?.[0] ?? "").toLowerCase();
    const selfClosing = /\/\s*$/.test(inner);
    index = end + 1;

    if (DROP_WITH_CONTENT.has(name)) {
      if (selfClosing) continue;
      if (RAW_TEXT.has(name)) {
        const close = html.toLowerCase().indexOf(`</${name}`, index);
        index = close < 0 ? html.length : (html.indexOf(">", close) + 1 || html.length);
      } else {
        // Skip the subtree, counting nested tags of the same name.
        const pattern = new RegExp(`<(/?)${name}\\b[^>]*>`, "gi");
        pattern.lastIndex = index;
        let depth = 1;
        let match: RegExpExecArray | null;
        while (depth > 0 && (match = pattern.exec(html))) depth += match[1] ? -1 : 1;
        index = depth > 0 ? html.length : pattern.lastIndex;
      }
      continue;
    }

    if (!ALLOWED_TAGS.has(name)) continue;

    // Browsers never nest <a> or <p>; closing them first keeps the stack sane.
    if ((name === "a" || name === "p") && stack.includes(name)) {
      const position = stack.lastIndexOf(name);
      while (stack.length > position) closeTag(stack.pop() as string);
    }

    openTag(name, parseAttributes(inner.slice(name.length).replace(/\/\s*$/, "")), selfClosing);
  }

  while (stack.length > 0) closeTag(stack.pop() as string);

  return {
    html: out.join("").trim(),
    text: text
      .join("")
      .replace(/[ \t ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

export function sanitizeEmailHtml(html: string) {
  return walk(html).html;
}

// Sanitized HTML with its links rewritten (tracking placeholders, UTMs, unsubscribe)
// plus a plain-text version for the text/plain part of the email.
export function renderEmailHtml(html: string, options: WalkOptions = {}) {
  return walk(html, options);
}

export function emailHtmlToText(html: string) {
  return walk(html).text;
}

export function emailHtmlHasUnsubscribeLink(html: string) {
  return html.includes(`href="${EMAIL_HTML_UNSUBSCRIBE_HREF}"`);
}
