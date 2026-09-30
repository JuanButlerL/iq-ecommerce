"use client";

import { Clock, Globe, Mail, Monitor, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";

import { NewsletterBlocksView, formatNewsletterDate } from "@/features/newsletter/components/newsletter-blocks";
import { estimateReadingMinutes, type NewsletterContent, type NewsletterProductSummary } from "@/features/newsletter/content";
import { buildNewsletterEmailSnapshot, personalizeNewsletterEmail } from "@/features/newsletter/render-email";
import { cn } from "@/lib/utils/cn";

export function NewsletterPreview({
  content,
  products,
  siteUrl,
  senderName,
  publishedAt,
}: {
  content: NewsletterContent;
  products: Record<string, NewsletterProductSummary>;
  siteUrl: string;
  senderName: string;
  publishedAt: string | null;
}) {
  const [channel, setChannel] = useState<"web" | "mail">("web");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  const emailHtml = useMemo(() => {
    if (channel !== "mail") return "";
    const snapshot = buildNewsletterEmailSnapshot({ content, products, siteUrl, webUrl: `${siteUrl}/newsletter/${content.slug}` });
    return personalizeNewsletterEmail(snapshot, { linkUrl: (_index, url) => url, unsubscribeUrl: "#", openPixelUrl: null }).html;
  }, [channel, content, products, siteUrl]);

  const tabClass = (active: boolean) =>
    cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-extrabold transition", active ? "bg-brand-ink text-white" : "text-brand-ink/60 hover:bg-white");

  return (
    <div className="overflow-hidden rounded-[2rem] bg-brand-ink/[0.04] ring-1 ring-brand-ink/8">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-ink/8 px-4 py-3">
        <div className="flex gap-1 rounded-full bg-brand-ink/5 p-1">
          <button type="button" className={tabClass(channel === "web")} onClick={() => setChannel("web")}>
            <Globe className="h-3.5 w-3.5" /> Web
          </button>
          <button type="button" className={tabClass(channel === "mail")} onClick={() => setChannel("mail")}>
            <Mail className="h-3.5 w-3.5" /> Mail
          </button>
        </div>
        <div className="flex gap-1 rounded-full bg-brand-ink/5 p-1">
          <button type="button" className={tabClass(device === "desktop")} onClick={() => setDevice("desktop")} aria-label="Vista escritorio">
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={tabClass(device === "mobile")} onClick={() => setDevice("mobile")} aria-label="Vista celular">
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {channel === "mail" ? (
        <div className="border-b border-brand-ink/8 bg-white px-5 py-3 text-xs leading-5 text-brand-ink/60">
          <p>
            <span className="font-bold text-brand-ink">{senderName}</span> · <span className="font-bold text-brand-ink">{content.emailSubject || "(sin asunto)"}</span>
          </p>
          <p className="truncate">{content.emailPreviewText || content.excerpt || "(sin texto de vista previa)"}</p>
        </div>
      ) : null}

      <div className="flex justify-center p-4">
        <div className={cn("w-full overflow-hidden bg-white shadow-card transition-all", device === "mobile" ? "max-w-[390px] rounded-[2rem]" : "rounded-[1.5rem]")}>
          {channel === "mail" ? (
            <iframe title="Vista previa del mail" srcDoc={emailHtml} sandbox="" className="h-[760px] w-full border-0" />
          ) : (
            <div className="max-h-[760px] overflow-y-auto">
              <div className={cn(device === "mobile" ? "px-5 py-7" : "px-8 py-9")}>
                <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand-ink/50">
                  {formatNewsletterDate(publishedAt ?? new Date())} · <Clock className="h-3.5 w-3.5" /> {estimateReadingMinutes(content)} min
                </p>
                {content.category ? <p className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-pink">{content.category}</p> : null}
                <h1 className={cn("mt-2 font-display leading-[1.03] text-brand-ink", device === "mobile" ? "text-[2.1rem]" : "text-[2.8rem]")}>{content.title || "Título"}</h1>
                {content.subtitle ? <p className="mt-3 text-lg leading-7 text-brand-ink/65">{content.subtitle}</p> : null}
                {content.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={content.coverImageUrl} alt={content.coverImageAlt ?? ""} className="mt-6 aspect-[16/9] w-full rounded-[1.75rem] object-cover" />
                ) : null}
                <div className="mt-6">
                  {content.blocks.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-brand-ink/15 p-6 text-center text-sm text-brand-ink/45">Agregá bloques para ver el contenido acá.</p>
                  ) : (
                    <NewsletterBlocksView blocks={content.blocks} products={products} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
