import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

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

function Cover({ newsletter, className }: { newsletter: NewsletterCardData; className?: string }) {
  if (!newsletter.coverImageUrl) {
    return <div className={cn("bg-[radial-gradient(circle_at_20%_20%,rgba(255,211,92,0.45),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(123,216,247,0.4),transparent_45%),linear-gradient(135deg,#FAD5D8,#fff2f3)]", className)} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={newsletter.coverImageUrl}
      alt={newsletter.coverImageAlt ?? newsletter.title}
      loading="lazy"
      className={cn("object-cover transition duration-500 group-hover:scale-[1.03]", className)}
    />
  );
}

export function NewsletterFeaturedCard({ newsletter }: { newsletter: NewsletterCardData }) {
  return (
    <Link
      href={`/newsletter/${newsletter.slug}`}
      className="group grid overflow-hidden rounded-[2.25rem] bg-white shadow-card ring-1 ring-brand-ink/5 transition hover:-translate-y-1 hover:shadow-soft lg:grid-cols-[1.15fr_1fr]"
    >
      <div className="relative aspect-[16/11] overflow-hidden lg:aspect-auto lg:min-h-[420px]">
        <Cover newsletter={newsletter} className="absolute inset-0 h-full w-full" />
        <span className="absolute left-5 top-5 rounded-full bg-white/95 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-pink shadow-sm">Última edición</span>
      </div>
      <div className="flex flex-col justify-center p-7 sm:p-10">
        <p className="text-sm font-bold text-brand-ink/45">
          {newsletter.category ? <span className="font-extrabold uppercase tracking-[0.14em] text-brand-pink">{newsletter.category} · </span> : null}
          <time>{formatNewsletterDate(newsletter.publishedAt)}</time>
        </p>
        <h2 className="mt-3 font-display text-[2.2rem] leading-[1.02] text-brand-ink sm:text-[2.8rem]">{newsletter.title}</h2>
        {newsletter.subtitle ? <p className="mt-3 text-lg leading-7 text-brand-ink/70">{newsletter.subtitle}</p> : null}
        <p className="mt-4 line-clamp-3 text-base leading-7 text-brand-ink/60">{newsletter.excerpt}</p>
        <span className="mt-7 inline-flex items-center gap-2 text-sm font-extrabold text-brand-pink">
          Leer newsletter <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

export function NewsletterCard({ newsletter }: { newsletter: NewsletterCardData }) {
  return (
    <Link
      href={`/newsletter/${newsletter.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[2rem] bg-white shadow-card ring-1 ring-brand-ink/5 transition hover:-translate-y-1 hover:shadow-soft"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Cover newsletter={newsletter} className="absolute inset-0 h-full w-full" />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-pink">
          {newsletter.category ? `${newsletter.category} · ` : ""}
          <time className="text-brand-ink/45">{formatNewsletterDate(newsletter.publishedAt)}</time>
        </p>
        <h3 className="mt-2 font-display text-[1.6rem] leading-[1.05] text-brand-ink">{newsletter.title}</h3>
        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-brand-ink/60">{newsletter.excerpt}</p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-extrabold text-brand-ink transition group-hover:text-brand-pink">
          Leer <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
