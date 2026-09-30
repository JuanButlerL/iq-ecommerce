import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { cache } from "react";

import { NewsletterBlocksView, formatNewsletterDate } from "@/features/newsletter/components/newsletter-blocks";
import { NewsletterCard } from "@/features/newsletter/components/newsletter-card";
import { NewsletterShareButtons } from "@/features/newsletter/components/newsletter-share-buttons";
import { NewsletterSubscribeForm } from "@/features/newsletter/components/newsletter-subscribe-form";
import { estimateReadingMinutes, toAbsoluteUrl } from "@/features/newsletter/content";
import { getNewsletterNeighbours, getNewsletterPageSettings, getPublishedNewsletterBySlug } from "@/features/newsletter/queries";
import { getNewsletterProductIds, getNewsletterWebUrl, loadNewsletterProducts, toNewsletterContent } from "@/features/newsletter/server-content";
import { env } from "@/lib/env";

type PageProps = { params: Promise<{ slug: string }> };

const loadNewsletter = cache(async (slug: string) => {
  const settings = await getNewsletterPageSettings();

  if (!settings.enabled) {
    return { newsletter: null, redirectTo: null };
  }

  return getPublishedNewsletterBySlug(slug);
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { newsletter } = await loadNewsletter(slug);

  if (!newsletter) {
    return { title: "Newsletter", robots: { index: false } };
  }

  const cover = newsletter.coverImageUrl ? toAbsoluteUrl(newsletter.coverImageUrl, env.NEXT_PUBLIC_SITE_URL) : undefined;

  return {
    title: newsletter.title,
    description: newsletter.excerpt,
    alternates: { canonical: `/newsletter/${newsletter.slug}` },
    openGraph: {
      title: newsletter.title,
      description: newsletter.excerpt,
      type: "article",
      url: `/newsletter/${newsletter.slug}`,
      siteName: "IQ Kids",
      publishedTime: newsletter.publishedAt?.toISOString(),
      modifiedTime: newsletter.updatedAt.toISOString(),
      images: cover ? [{ url: cover, alt: newsletter.coverImageAlt ?? newsletter.title }] : undefined,
    },
    twitter: { card: cover ? "summary_large_image" : "summary", title: newsletter.title, description: newsletter.excerpt, images: cover ? [cover] : undefined },
  };
}

export default async function NewsletterDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const { newsletter, redirectTo } = await loadNewsletter(slug);

  if (!newsletter) {
    if (redirectTo) {
      permanentRedirect(`/newsletter/${redirectTo}`);
    }

    notFound();
  }

  const content = toNewsletterContent(newsletter);
  const [products, neighbours] = await Promise.all([loadNewsletterProducts(getNewsletterProductIds(content)), getNewsletterNeighbours(newsletter)]);
  const url = getNewsletterWebUrl(newsletter.slug);
  const minutes = estimateReadingMinutes(content);
  const cover = newsletter.coverImageUrl ? toAbsoluteUrl(newsletter.coverImageUrl, env.NEXT_PUBLIC_SITE_URL) : null;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: newsletter.title,
    description: newsletter.excerpt,
    datePublished: newsletter.publishedAt?.toISOString(),
    dateModified: newsletter.updatedAt.toISOString(),
    mainEntityOfPage: url,
    image: cover ? [cover] : undefined,
    author: { "@type": "Organization", name: "IQ Kids", url: env.NEXT_PUBLIC_SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "IQ Kids",
      logo: { "@type": "ImageObject", url: `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/brand/iq-kids-logo.png` },
    },
  };
  const others = neighbours.more.filter((item) => item.slug !== neighbours.newer?.slug && item.slug !== neighbours.older?.slug);

  return (
    <div className="bg-white text-brand-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />

      <article>
        <header className="mx-auto max-w-[820px] px-5 pb-8 pt-9 sm:px-8 sm:pt-12 lg:pt-14">
          <Link href="/newsletter" className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-pink transition hover:gap-3">
            <ArrowLeft className="h-4 w-4" /> Newsletter
          </Link>
          <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-bold text-brand-ink/50">
            <time dateTime={newsletter.publishedAt?.toISOString()}>{formatNewsletterDate(newsletter.publishedAt)}</time>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden /> {minutes} min de lectura
            </span>
          </p>
          {newsletter.category ? <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-pink">{newsletter.category}</p> : null}
          <h1 className="mt-3 font-display text-[2.45rem] leading-[1.02] sm:text-[3.3rem] lg:text-[3.8rem]">{newsletter.title}</h1>
          {newsletter.subtitle ? <p className="mt-4 text-lg leading-8 text-brand-ink/65 sm:text-xl">{newsletter.subtitle}</p> : null}
          <div className="mt-7">
            <NewsletterShareButtons url={url} title={newsletter.title} />
          </div>
        </header>

        {newsletter.coverImageUrl ? (
          <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={newsletter.coverImageUrl}
              alt={newsletter.coverImageAlt ?? newsletter.title}
              className="aspect-[16/9] w-full rounded-[2.25rem] object-cover shadow-card"
            />
          </div>
        ) : null}

        <div className="mx-auto max-w-[760px] px-5 pb-6 pt-8 sm:px-8 sm:pt-10">
          <NewsletterBlocksView blocks={content.blocks} products={products} />
          <div className="mt-12 border-t border-brand-ink/10 pt-7">
            <NewsletterShareButtons url={url} title={newsletter.title} />
          </div>
        </div>
      </article>

      <div className="mx-auto max-w-[1200px] space-y-14 px-5 pb-16 pt-8 sm:px-8 sm:pb-20 lg:px-10">
        {neighbours.newer || neighbours.older ? (
          <nav aria-label="Otras ediciones" className="grid gap-4 sm:grid-cols-2">
            {neighbours.older ? (
              <Link href={`/newsletter/${neighbours.older.slug}`} className="group rounded-[1.75rem] p-6 ring-1 ring-brand-ink/10 transition hover:ring-brand-pink/40">
                <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink/45">
                  <ArrowLeft className="h-4 w-4" /> Anterior
                </span>
                <p className="mt-2 font-display text-xl leading-tight group-hover:text-brand-pink">{neighbours.older.title}</p>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {neighbours.newer ? (
              <Link href={`/newsletter/${neighbours.newer.slug}`} className="group rounded-[1.75rem] p-6 text-right ring-1 ring-brand-ink/10 transition hover:ring-brand-pink/40">
                <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink/45">
                  Siguiente <ArrowRight className="h-4 w-4" />
                </span>
                <p className="mt-2 font-display text-xl leading-tight group-hover:text-brand-pink">{neighbours.newer.title}</p>
              </Link>
            ) : null}
          </nav>
        ) : null}

        {others.length > 0 ? (
          <section aria-labelledby="more-newsletters">
            <h2 id="more-newsletters" className="mb-6 font-display text-3xl">Más newsletters</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((item) => (
                <NewsletterCard key={item.slug} newsletter={item} />
              ))}
            </div>
          </section>
        ) : null}

        <NewsletterSubscribeForm />
      </div>
    </div>
  );
}
