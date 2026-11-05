"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EMAIL_HTML_UNSUBSCRIBE_HREF, EMAIL_HTML_WEB_HREF, renderEmailHtml, sanitizeEmailCss } from "@/features/newsletter/email-html";

// Shows an imported email design on the web exactly as authored. It runs in a
// sandboxed iframe (no scripts) so its styles never touch the site and the site's
// styles (Tailwind reset) never change the email. The frame grows to its content.
export function NewsletterHtmlFrame({ html, css, title = "Contenido del newsletter" }: { html: string; css?: string | null; title?: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(480);

  const srcDoc = useMemo(() => {
    const body = renderEmailHtml(html, {
      // The web page has no unsubscribe link and already is the "web version".
      rewriteHref: (href) => (href === EMAIL_HTML_UNSUBSCRIBE_HREF || href === EMAIL_HTML_WEB_HREF ? null : href),
    }).html;
    const styles = sanitizeEmailCss(css).replace(/<\//g, "");
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>html,body{margin:0;padding:0;}img{max-width:100%;height:auto;}table{max-width:100%;}</style>${styles ? `<style>${styles}</style>` : ""}</head><body>${body}</body></html>`;
  }, [html, css]);

  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.documentElement) return;
    const next = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
    if (next > 0) setHeight(next);
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let observer: ResizeObserver | null = null;

    const onLoad = () => {
      measure();
      const body = frame.contentDocument?.body;
      if (body && typeof ResizeObserver !== "undefined") {
        observer?.disconnect();
        observer = new ResizeObserver(measure);
        observer.observe(body);
      }
      // Late images change the height after load.
      frame.contentDocument?.querySelectorAll("img").forEach((image) => image.addEventListener("load", measure));
    };

    frame.addEventListener("load", onLoad);
    window.addEventListener("resize", measure);
    return () => {
      frame.removeEventListener("load", onLoad);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [measure, srcDoc]);

  return (
    <iframe
      ref={frameRef}
      title={title}
      srcDoc={srcDoc}
      // allow-same-origin only lets the page measure the height: scripts stay blocked.
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      className="my-8 block w-full border-0"
      style={{ height }}
    />
  );
}
