import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { cache } from "react";

import { NewsletterBlocksView, formatNewsletterDate } from "@/features/newsletter/components/newsletter-blocks";
import { NewsletterCard, NewsletterMiniCard } from "@/features/newsletter/components/newsletter-card";
import { NewsletterShareButtons } from "@/features/newsletter/components/newsletter-share-buttons";
import { NewsletterSubscribeForm } from "@/features/newsletter/components/newsletter-subscribe-form";
import { estimateReadingMinutes, toAbsoluteUrl } from "@/features/newsletter/content";
import { getNewsletterNeighbours, getNewsletterPageSettings, getPublishedNewsletterBySlug } from "@/features/newsletter/queries";
import { getNewsletterProductIds, getNewsletterWebUrl, loadNewsletterProducts, toNewsletterContent } from "@/features/newsletter/server-content";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils/cn";

type PageProps = { params: Promise<{ slug: string }> };

// A newsletter marked "Mostrar en la web" opens by its own link even when the
// section is not in the menu yet. The section toggle only controls the menu and
// the /newsletter archive.
const loadNewsletter = cache(async (slug: string) => getPublishedNewsletterBySlug(slug));

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
  const [products, neighbours, pageSettings] = await Promise.all([
    loadNewsletterProducts(getNewsletterProductIds(content)),
    getNewsletterNeighbours(newsletter),
    getNewsletterPageSettings(),
  ]);
  const sectionEnabled = pageSettings.enabled;
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

      <article className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
        <header className="max-w-[900px] pb-8 pt-10 sm:pb-10 sm:pt-14">
          {sectionEnabled ? (
            <Link href="/newsletter" className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-ink/50 transition hover:text-brand-pink">
              <ArrowLeft className="h-4 w-4" /> Newsletter
            </Link>
          ) : (
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-ink/50">Newsletter IQ Kids</p>
          )}
          {newsletter.category ? <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-pink">{newsletter.category}</p> : null}
          <h1 className={cn("font-display text-[2.4rem] leading-[1.02] sm:text-[3.2rem] lg:text-[3.8rem]", newsletter.category ? "mt-3" : "mt-8")}>{newsletter.title}</h1>
          {newsletter.subtitle ? <p className="mt-5 max-w-3xl text-lg leading-8 text-brand-ink/65 sm:text-xl">{newsletter.subtitle}</p> : null}
          <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-brand-ink/10 pt-5 text-sm font-bold text-brand-ink/50">
            <span className="text-brand-ink">Por IQ Kids</span>
            <span aria-hidden>·</span>
            <time dateTime={newsletter.publishedAt?.toISOString()}>{formatNewsletterDate(newsletter.publishedAt)}</time>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden /> {minutes} min de lectura
            </span>
          </p>
        </header>

        {newsletter.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={newsletter.coverImageUrl}
            alt={newsletter.coverImageAlt ?? newsletter.title}
            className="aspect-[16/9] max-h-[620px] w-full rounded-[2rem] object-cover"
          />
        ) : null}

        <div className="grid gap-12 pb-16 pt-10 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16">
          <div className="min-w-0 max-w-[820px]">
            <NewsletterBlocksView blocks={content.blocks} products={products} />

            <div className="mt-12 border-t border-brand-ink/10 pt-6 lg:hidden">
              <NewsletterShareButtons url={url} title={newsletter.title} />
            </div>

            {neighbours.newer || neighbours.older ? (
              <nav aria-label="Otras ediciones" className="mt-12 grid gap-4 border-t border-brand-ink/10 pt-8 sm:grid-cols-2">
                {neighbours.older ? (
                  <Link href={`/newsletter/${neighbours.older.slug}`} className="group">
                    <span className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">
                      <ArrowLeft className="h-4 w-4" /> Edición anterior
                    </span>
                    <p className="mt-2 font-display text-xl leading-tight transition group-hover:text-brand-pink">{neighbours.older.title}</p>
                  </Link>
                ) : (
                  <span className="hidden sm:block" />
                )}
                {neighbours.newer ? (
                  <Link href={`/newsletter/${neighbours.newer.slug}`} className="group sm:text-right">
                    <span className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">
                      Edición siguiente <ArrowRight className="h-4 w-4" />
                    </span>
                    <p className="mt-2 font-display text-xl leading-tight transition group-hover:text-brand-pink">{neighbours.newer.title}</p>
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-8">
              <div>
                <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-ink/45">Compartir</p>
                <NewsletterShareButtons url={url} title={newsletter.title} layout="stack" />
              </div>
              <NewsletterSubscribeForm variant="compact" />
              {others.length > 0 ? (
                <div>
                  <p className="mb-4 text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-ink/45">Más ediciones</p>
                  <div className="space-y-4">
                    {others.map((item) => (
                      <NewsletterMiniCard key={item.slug} newsletter={item} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </article>

      <div className="mx-auto max-w-[1200px] space-y-14 px-5 pb-16 sm:px-8 lg:hidden">
        {others.length > 0 ? (
          <section aria-labelledby="more-newsletters">
            <h2 id="more-newsletters" className="mb-6 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-ink/55">
              Más ediciones
            </h2>
            <div className="grid gap-10 sm:grid-cols-2">
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
