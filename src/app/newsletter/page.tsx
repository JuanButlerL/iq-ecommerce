import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { NewsletterCard, NewsletterFeaturedCard } from "@/features/newsletter/components/newsletter-card";
import { NewsletterSubscribeForm } from "@/features/newsletter/components/newsletter-subscribe-form";
import { getNewsletterPageSettings, getPublishedNewsletters } from "@/features/newsletter/queries";

type PageProps = { searchParams: Promise<{ pagina?: string }> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const [settings, { pagina }] = await Promise.all([getNewsletterPageSettings(), searchParams]);
  const page = Number(pagina) > 1 ? Number(pagina) : 1;

  return {
    title: page > 1 ? `Newsletter — página ${page}` : "Newsletter",
    description: settings.description,
    alternates: { canonical: page > 1 ? `/newsletter?pagina=${page}` : "/newsletter" },
    openGraph: { title: `${settings.title} | IQ Kids`, description: settings.description, type: "website", url: "/newsletter" },
  };
}

export default async function NewsletterArchivePage({ searchParams }: PageProps) {
  const settings = await getNewsletterPageSettings();

  if (!settings.enabled) {
    notFound();
  }

  const { pagina } = await searchParams;
  const { items, page, pageCount, total } = await getPublishedNewsletters(Number(pagina) || 1);
  const [featured, ...rest] = page === 1 ? items : [null, ...items];

  return (
    <div className="bg-white text-brand-ink">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8 lg:px-10">
        <header className="grid gap-6 border-b border-brand-ink/10 pb-10 pt-12 sm:pt-16 lg:grid-cols-[1fr_auto] lg:items-end lg:pb-12">
          <div className="max-w-3xl">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-pink sm:text-xs">{settings.eyebrow}</p>
            <h1 className="mt-4 font-display text-[2.6rem] leading-[1] sm:text-[3.4rem] lg:text-[4rem]">{settings.title}</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-brand-ink/60 sm:text-lg sm:leading-8">{settings.description}</p>
          </div>
          {total > 0 ? (
            <p className="text-sm font-bold text-brand-ink/45 lg:text-right">
              <span className="block font-display text-4xl text-brand-ink">{total}</span>
              {total === 1 ? "edición publicada" : "ediciones publicadas"}
            </p>
          ) : null}
        </header>

        <div className="space-y-16 py-12 sm:py-14">
          {total === 0 ? (
            <div className="rounded-[2rem] border border-brand-ink/10 px-6 py-16 text-center">
              <p className="font-display text-2xl">Muy pronto, la primera edición</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-brand-ink/60">Suscribite y te avisamos apenas salga.</p>
            </div>
          ) : null}

          {featured ? <NewsletterFeaturedCard newsletter={featured} /> : null}

          {rest.length > 0 ? (
            <section aria-labelledby="archive-heading">
              <div className="mb-8 flex items-center gap-4">
                <h2 id="archive-heading" className="shrink-0 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-ink/55">
                  {page === 1 ? "Ediciones anteriores" : `Página ${page}`}
                </h2>
                <span className="h-px flex-1 bg-brand-ink/10" aria-hidden />
              </div>
              <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((newsletter) => (newsletter ? <NewsletterCard key={newsletter.slug} newsletter={newsletter} /> : null))}
              </div>
            </section>
          ) : null}

          {pageCount > 1 ? (
            <nav aria-label="Paginación" className="flex items-center justify-between gap-4 border-t border-brand-ink/10 pt-8">
              {page > 1 ? (
                <Link href={page === 2 ? "/newsletter" : `/newsletter?pagina=${page - 1}`} className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-ink hover:text-brand-pink">
                  <ArrowLeft className="h-4 w-4" /> Más recientes
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm font-bold text-brand-ink/45">
                Página {page} de {pageCount}
              </span>
              {page < pageCount ? (
                <Link href={`/newsletter?pagina=${page + 1}`} className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-ink hover:text-brand-pink">
                  Anteriores <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}

          <NewsletterSubscribeForm />
        </div>
      </div>
    </div>
  );
}
