import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Newspaper } from "lucide-react";

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
    <div className="overflow-hidden bg-white text-brand-ink">
      <header className="relative mx-auto max-w-[1200px] px-5 pb-8 pt-10 sm:px-8 sm:pb-12 sm:pt-14 lg:px-10 lg:pt-16">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-16 h-72 w-72 rounded-full bg-brand-yellow/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -left-24 top-24 h-64 w-64 rounded-full bg-brand-pinkSoft/50 blur-3xl" />
        <div className="relative max-w-[820px]">
          <p className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-pink sm:text-xs">
            <Newspaper className="h-4 w-4" aria-hidden /> {settings.eyebrow}
          </p>
          <h1 className="mt-4 font-display text-[2.5rem] leading-[1.02] sm:text-[3.3rem] lg:text-[3.9rem]">{settings.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-brand-ink/65 sm:text-lg sm:leading-8">{settings.description}</p>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] space-y-12 px-5 pb-16 sm:px-8 sm:pb-20 lg:px-10">
        {total === 0 ? (
          <div className="rounded-[2.25rem] border border-dashed border-brand-pink/30 bg-brand-pink/5 px-6 py-16 text-center">
            <Newspaper className="mx-auto h-10 w-10 text-brand-pink" aria-hidden />
            <p className="mt-4 font-display text-2xl">Muy pronto, la primera edición</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-brand-ink/60">Suscribite abajo y te avisamos apenas salga.</p>
          </div>
        ) : null}

        {featured ? <NewsletterFeaturedCard newsletter={featured} /> : null}

        {rest.length > 0 ? (
          <section aria-label="Ediciones anteriores">
            {page === 1 ? <h2 className="mb-6 font-display text-3xl">Ediciones anteriores</h2> : null}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((newsletter) => (newsletter ? <NewsletterCard key={newsletter.slug} newsletter={newsletter} /> : null))}
            </div>
          </section>
        ) : null}

        {pageCount > 1 ? (
          <nav aria-label="Paginación" className="flex items-center justify-between gap-4">
            {page > 1 ? (
              <Link href={page === 2 ? "/newsletter" : `/newsletter?pagina=${page - 1}`} className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-extrabold ring-1 ring-brand-ink/10 transition hover:ring-brand-pink/40">
                <ArrowLeft className="h-4 w-4" /> Más nuevas
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm font-bold text-brand-ink/45">
              Página {page} de {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={`/newsletter?pagina=${page + 1}`} className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-pink px-5 text-sm font-extrabold text-white shadow-soft transition hover:bg-[#ea737d]">
                Más anteriores <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}

        <NewsletterSubscribeForm />
      </div>
    </div>
  );
}
