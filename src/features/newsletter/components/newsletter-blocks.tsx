import Link from "next/link";
import { BookOpen, Check, Quote, Sparkles, X } from "lucide-react";
import type { ReactNode } from "react";

import {
  parseInline,
  splitParagraphs,
  type NewsletterBlock,
  type NewsletterProductSummary,
  type NewsletterAccentTone,
  type NewsletterTipTone,
} from "@/features/newsletter/content";
import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";

// No hooks: renders on the public server page and inside the admin live preview.

const tipToneClasses: Record<NewsletterTipTone, string> = {
  pink: "bg-brand-pinkSoft/45 ring-brand-pink/20",
  yellow: "bg-brand-yellow/20 ring-brand-yellow/50",
  cyan: "bg-brand-cyan/15 ring-brand-cyan/40",
  mint: "bg-brand-mint ring-emerald-200",
};

const accentClasses: Record<NewsletterAccentTone, { solid: string; soft: string; text: string; border: string }> = {
  pink: { solid: "bg-brand-pink", soft: "bg-[linear-gradient(120deg,#fff2f3,#fffdfa)]", text: "text-brand-pink", border: "border-brand-pink" },
  cyan: { solid: "bg-brand-cyan", soft: "bg-brand-cyan/12", text: "text-sky-700", border: "border-brand-cyan" },
};

export function formatNewsletterDate(value: Date | string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

function isExternal(url: string) {
  return /^(https?:|mailto:)/i.test(url);
}

function InlineText({ value }: { value: string }) {
  return (
    <>
      {parseInline(value).map((token, index) => {
        if (token.type === "bold") return <strong key={index} className="font-extrabold text-brand-ink">{token.text}</strong>;
        if (token.type === "italic") return <em key={index}>{token.text}</em>;
        if (token.type === "link") {
          return (
            <a
              key={index}
              href={token.url}
              {...(isExternal(token.url) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="font-bold text-brand-pink underline decoration-brand-pink/40 underline-offset-4 transition hover:decoration-brand-pink"
            >
              {token.text}
            </a>
          );
        }

        return <span key={index} className="whitespace-pre-line">{token.text}</span>;
      })}
    </>
  );
}

function Paragraphs({ value, className }: { value: string; className?: string }) {
  return (
    <>
      {splitParagraphs(value).map((paragraph, index) => (
        <p key={index} className={className}>
          <InlineText value={paragraph} />
        </p>
      ))}
    </>
  );
}

function Figure({ children, caption }: { children: ReactNode; caption?: string | null }) {
  return (
    <figure className="my-9">
      {children}
      {caption ? <figcaption className="mt-3 text-center text-sm leading-6 text-brand-ink/55">{caption}</figcaption> : null}
    </figure>
  );
}

function BlockImage({ url, alt, className }: { url: string; alt: string; className?: string }) {
  if (!url) {
    return <div className={cn("flex aspect-[4/3] items-center justify-center rounded-[1.75rem] bg-brand-pinkSoft/30 text-sm font-bold text-brand-ink/40", className)}>Imagen pendiente</div>;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} loading="lazy" className={cn("h-auto w-full rounded-[1.75rem] object-cover", className)} />;
}

function Block({ block, products }: { block: NewsletterBlock; products: Record<string, NewsletterProductSummary> }) {
  const paragraphClass = "mb-5 text-[1.075rem] leading-8 text-brand-ink/80";

  switch (block.type) {
    case "heading":
      return <h2 className="mb-4 mt-12 font-display text-[1.9rem] leading-[1.08] text-brand-ink sm:text-[2.25rem]">{block.text}</h2>;

    case "paragraph":
      return <Paragraphs value={block.text} className={paragraphClass} />;

    case "image":
      return (
        <Figure caption={block.caption}>
          <BlockImage url={block.url} alt={block.alt} className="shadow-card" />
        </Figure>
      );

    case "imageText":
      return (
        <div className={cn("my-10 grid items-center gap-6 sm:grid-cols-2 sm:gap-8", block.imagePosition === "right" && "sm:[&>*:first-child]:order-2")}>
          <BlockImage url={block.url} alt={block.alt} className="aspect-[4/3] shadow-card" />
          <div>
            {block.title ? <h3 className="mb-3 font-display text-2xl leading-tight text-brand-ink">{block.title}</h3> : null}
            <Paragraphs value={block.text} className="mb-4 text-base leading-7 text-brand-ink/75" />
          </div>
        </div>
      );

    case "gallery":
      return (
        <Figure caption={block.caption}>
          <div className={cn("grid gap-3 sm:gap-4", block.images.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
            {block.images.map((image, index) => (
              <BlockImage key={index} url={image.url} alt={image.alt} className="aspect-square" />
            ))}
          </div>
        </Figure>
      );

    case "quote": {
      const tone = accentClasses[block.tone ?? "pink"];
      return (
        <blockquote className={cn("relative my-10 rounded-[2rem] px-7 py-8 sm:px-10", tone.soft)}>
          <Quote className={cn("absolute -top-4 left-7 h-9 w-9 rounded-full p-2 text-white shadow-soft", tone.solid)} aria-hidden />
          <p className="font-display text-[1.45rem] leading-snug text-brand-ink sm:text-[1.7rem]">“{block.text}”</p>
          {block.author ? (
            <footer className="mt-4 text-sm leading-6 text-brand-ink/60">
              <span className={cn("font-extrabold", tone.text)}>{block.author}</span>
              {block.role ? <span> — {block.role}</span> : null}
            </footer>
          ) : null}
        </blockquote>
      );
    }

    case "button":
      return (
        <div className="my-9 flex flex-col items-center gap-2">
          <a
            href={block.url || "#"}
            {...(isExternal(block.url) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className={cn(
              "inline-flex min-h-14 items-center justify-center rounded-full px-8 py-3 text-center text-base font-extrabold text-white shadow-soft transition hover:-translate-y-0.5",
              block.tone === "cyan" ? "bg-sky-500 hover:bg-sky-600" : "bg-brand-pink hover:bg-[#ea737d]",
            )}
          >
            {block.label || "Botón"}
          </a>
          {block.note ? <p className="text-sm text-brand-ink/50">{block.note}</p> : null}
        </div>
      );

    case "product": {
      const product = products[block.productId];

      if (!product) {
        return <div className="my-8 rounded-[1.75rem] border border-dashed border-brand-pink/30 p-6 text-center text-sm font-bold text-brand-ink/45">Elegí un producto para este bloque</div>;
      }

      return (
        <div className="my-10 overflow-hidden rounded-[2rem] bg-white shadow-card ring-1 ring-brand-pink/15">
          <div className="grid items-center gap-5 p-5 sm:grid-cols-[180px_1fr] sm:p-6">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} loading="lazy" className="aspect-square w-full rounded-[1.5rem] bg-brand-pinkSoft/30 object-cover" />
            ) : (
              <div className="aspect-square w-full rounded-[1.5rem] bg-brand-pinkSoft/30" />
            )}
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">Producto destacado</p>
              <h3 className="mt-2 font-display text-[1.7rem] leading-none text-brand-ink">{product.name}</h3>
              {block.note ? <p className="mt-3 text-sm leading-6 text-brand-ink/65">{block.note}</p> : null}
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <span className="text-2xl font-extrabold text-brand-pink">{formatArs(product.priceArs)}</span>
                <Link
                  href={`/productos/${product.slug}`}
                  className="inline-flex h-11 items-center rounded-full bg-brand-ink px-6 text-sm font-extrabold text-white transition hover:bg-brand-ink/90"
                >
                  {product.available ? "Comprar" : "Ver producto"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }

    case "tip":
      return (
        <aside className={cn("my-10 rounded-[2rem] p-6 ring-1 sm:p-8", tipToneClasses[block.tone])}>
          {block.title ? (
            <p className="mb-3 flex items-center gap-2 font-display text-[1.45rem] leading-tight text-brand-ink">
              <Sparkles className="h-5 w-5 shrink-0 text-brand-pink" aria-hidden />
              {block.title}
            </p>
          ) : null}
          <div>
            <Paragraphs value={block.text} className="mb-3 text-base leading-7 text-brand-ink/80 last:mb-0" />
          </div>
        </aside>
      );

    case "stats": {
      const tone = accentClasses[block.tone];
      return (
        <div className={cn("my-9 grid gap-3 sm:gap-4", block.items.length === 3 ? "sm:grid-cols-3" : block.items.length === 2 ? "grid-cols-2" : "")}>
          {block.items.map((item, index) => (
            <div key={index} className={cn("rounded-[1.75rem] px-5 py-6 text-center", block.tone === "cyan" ? "bg-brand-cyan/15" : "bg-brand-pinkSoft/40")}>
              <p className={cn("font-display text-[2.4rem] leading-none", tone.text)}>{item.value}</p>
              <p className="mt-2 text-sm leading-5 text-brand-ink/70">{item.label}</p>
            </div>
          ))}
        </div>
      );
    }

    case "steps": {
      const tone = accentClasses[block.tone];
      let number = 0;
      return (
        <ol className="my-8 space-y-3">
          {block.items.map((item, index) => {
            if (item.marker === "number") number += 1;
            return (
              <li key={index} className="flex items-start gap-4 rounded-[1.5rem] bg-brand-ink/[0.03] p-4 sm:p-5">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white",
                    item.marker === "cross" ? "bg-brand-ink/40" : tone.solid,
                  )}
                  aria-hidden
                >
                  {item.marker === "number" ? number : item.marker === "check" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </span>
                <div className="min-w-0 pt-1">
                  <p className="font-extrabold leading-snug text-brand-ink">{item.title}</p>
                  {item.text ? <Paragraphs value={item.text} className="mt-1 text-[0.95rem] leading-6 text-brand-ink/70" /> : null}
                </div>
              </li>
            );
          })}
        </ol>
      );
    }

    case "testimonial":
      return (
        <figure className="my-8 flex items-start gap-4 rounded-[1.75rem] border-l-4 border-brand-pink bg-brand-pinkSoft/25 p-5 sm:p-6">
          {block.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={block.imageUrl} alt={block.imageAlt ?? block.author} loading="lazy" className="h-14 w-14 shrink-0 rounded-full object-cover ring-4 ring-white" />
          ) : null}
          <div>
            <blockquote className="text-[1.05rem] italic leading-7 text-brand-ink/80">“{block.quote}”</blockquote>
            <figcaption className="mt-2 text-sm text-brand-ink/55">
              <span className="font-extrabold text-brand-ink">{block.author}</span>
              {block.detail ? <span> · {block.detail}</span> : null}
            </figcaption>
          </div>
        </figure>
      );

    case "sources":
      return (
        <aside className="my-8 rounded-[1.5rem] bg-brand-ink/[0.04] px-5 py-4">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-ink/50">
            <BookOpen className="h-3.5 w-3.5" aria-hidden /> {block.label}
          </p>
          <Paragraphs value={block.text} className="mt-2 text-xs leading-5 text-brand-ink/55" />
        </aside>
      );

    case "divider":
      return (
        <div className="my-12 flex items-center justify-center gap-2" aria-hidden>
          <span className="h-2 w-2 rounded-full bg-brand-pink" />
          <span className="h-2 w-2 rounded-full bg-brand-yellow" />
          <span className="h-2 w-2 rounded-full bg-brand-cyan" />
        </div>
      );
  }
}

export function NewsletterBlocksView({ blocks, products }: { blocks: NewsletterBlock[]; products: Record<string, NewsletterProductSummary> }) {
  return (
    <div className="newsletter-body">
      {blocks.map((block) => (
        <Block key={block.id} block={block} products={products} />
      ))}
    </div>
  );
}
