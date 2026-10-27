import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { formatNewsletterDate } from "@/features/newsletter/components/newsletter-blocks";
import { cn } from "@/lib/utils/cn";

export type NewsletterCardData = {
  slug: string;
  title: string;
  subtitle?: string | null;
  excerpt: string;
  category?: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  publishedAt: Date | null;
};

// Photo when there is one; otherwise a quiet typographic cover in brand colors.
export function NewsletterCover({ newsletter, className, size = "md" }: { newsletter: NewsletterCardData; className?: string; size?: "md" | "lg" }) {
  if (newsletter.coverImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={newsletter.coverImageUrl}
        alt={newsletter.coverImageAlt ?? newsletter.title}
        loading="lazy"
        className={cn("h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]", className)}
      />
    );
  }

  return (
    <div className={cn("flex h-full w-full flex-col justify-between bg-[#FDEDEE] p-6", size === "lg" && "p-8 md:p-10", className)} aria-hidden>
      <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-pink">Newsletter IQ Kids</span>
      <span className={cn("font-display leading-[0.95] text-brand-ink/85", size === "lg" ? "text-[2.6rem] md:text-[3.4rem]" : "text-[1.9rem]")}>
        {newsletter.category || "Ideas para la semana"}
      </span>
    </div>
  );
}

function Meta({ newsletter, className }: { newsletter: NewsletterCardData; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 text-[11px] font-extrabold uppercase tracking-[0.16em]", className)}>
      {newsletter.category ? <span className="text-brand-pink">{newsletter.category}</span> : null}
      {newsletter.category ? <span className="text-brand-ink/25">/</span> : null}
      <time className="text-brand-ink/45">{formatNewsletterDate(newsletter.publishedAt)}</time>
    </p>
  );
}

export function NewsletterFeaturedCard({ newsletter }: { newsletter: NewsletterCardData }) {
  return (
    <Link
      href={`/newsletter/${newsletter.slug}`}
      className="group grid overflow-hidden rounded-[2rem] border border-brand-ink/10 bg-white transition hover:border-brand-ink/20 hover:shadow-card lg:grid-cols-[1.1fr_1fr]"
    >
      <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto lg:min-h-[400px]">
        <NewsletterCover newsletter={newsletter} size="lg" className="absolute inset-0" />
      </div>
      <div className="flex flex-col justify-center gap-5 p-7 sm:p-10 lg:p-12">
        <span className="w-fit rounded-full bg-brand-ink px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white">Última edición</span>
        <Meta newsletter={newsletter} />
        <h2 className="font-display text-[2.1rem] leading-[1.02] text-brand-ink sm:text-[2.6rem]">{newsletter.title}</h2>
        {newsletter.subtitle ? <p className="text-lg leading-7 text-brand-ink/70">{newsletter.subtitle}</p> : null}
        <p className="line-clamp-3 text-base leading-7 text-brand-ink/60">{newsletter.excerpt}</p>
        <span className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-ink">
          Leer edición
          <ArrowRight className="h-4 w-4 text-brand-pink transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

export function NewsletterCard({ newsletter }: { newsletter: NewsletterCardData }) {
  return (
    <Link href={`/newsletter/${newsletter.slug}`} className="group flex h-full flex-col">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] border border-brand-ink/8">
        <NewsletterCover newsletter={newsletter} className="absolute inset-0" />
      </div>
      <div className="flex flex-1 flex-col pt-5">
        <Meta newsletter={newsletter} />
        <h3 className="mt-3 font-display text-[1.55rem] leading-[1.08] text-brand-ink transition group-hover:text-brand-pink">{newsletter.title}</h3>
        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-brand-ink/60">{newsletter.excerpt}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-ink">
          Leer
          <ArrowRight className="h-4 w-4 text-brand-pink transition group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

// Compact row used in the article sidebar.
export function NewsletterMiniCard({ newsletter }: { newsletter: NewsletterCardData }) {
  return (
    <Link href={`/newsletter/${newsletter.slug}`} className="group flex items-start gap-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-brand-ink/8">
        {newsletter.coverImageUrl ? (
          <NewsletterCover newsletter={newsletter} className="absolute inset-0" />
        ) : (
          <div className="h-full w-full bg-[#FDEDEE]" aria-hidden />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-ink/40">{formatNewsletterDate(newsletter.publishedAt)}</p>
        <p className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-brand-ink transition group-hover:text-brand-pink">{newsletter.title}</p>
      </div>
    </Link>
  );
}
