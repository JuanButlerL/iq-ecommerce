import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CircleHelp, MessageCircle } from "lucide-react";

import { FaqExplorer } from "@/features/faq/components/faq-explorer";
import { getPublishedFaqs } from "@/features/faq/queries";
import { getStoreSettings } from "@/features/settings/queries";
import { buildWhatsappUrl } from "@/lib/utils/whatsapp";

export const metadata: Metadata = {
  title: "Preguntas frecuentes | IQ Kids",
  description: "Respuestas claras sobre productos, compras, pagos y envíos de IQ Kids.",
};

export default async function FrequentlyAskedQuestionsPage() {
  const settings = await getStoreSettings();
  if (!settings?.faqSectionEnabled) notFound();
  const faqs = await getPublishedFaqs();
  const eyebrow = settings.faqEyebrow ?? "Estamos para ayudarte";
  const title = settings.faqTitle ?? "Las respuestas que";
  const titleAccent = settings.faqTitleAccent ?? "necesitás.";
  const description = settings.faqDescription ?? "Comprar algo rico y simple debería ser fácil. Acá reunimos las dudas más comunes para que puedas elegir con tranquilidad.";
  const supportTitle = settings.faqSupportTitle ?? "¿Te quedó alguna duda?";
  const supportText = settings.faqSupportText ?? "Estamos del otro lado para ayudarte con tu compra.";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <div className="min-h-screen overflow-hidden bg-white text-brand-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <header className="mx-auto max-w-[1200px] px-5 pb-7 pt-9 sm:px-8 sm:pb-9 sm:pt-12 lg:px-10 lg:pt-14">
        <div className="max-w-[790px]">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-pink sm:text-xs">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-display text-[2.3rem] leading-[1.02] sm:text-[3.15rem] lg:text-[3.55rem]">
            {title} <span className="text-brand-pink">{titleAccent}</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-ink/65 sm:text-base sm:leading-7">
            {description}
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1200px] gap-10 px-5 pb-14 pt-2 sm:px-8 sm:pb-16 sm:pt-3 lg:grid-cols-[minmax(0,1fr)_290px] lg:gap-14 lg:px-10 lg:pb-20">
        <section aria-labelledby="faq-heading" className="min-w-0">
          <div className="mb-5 flex flex-col gap-1 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <h2 id="faq-heading" className="font-display text-2xl sm:text-3xl">Encontrá tu respuesta</h2>
            <p className="text-sm text-brand-ink/50">Buscá o tocá una pregunta para abrirla.</p>
          </div>
          <FaqExplorer faqs={faqs} />
        </section>

        <aside className="lg:pt-11">
          <div className="rounded-[2rem] border border-brand-pink/15 bg-[#fffafa] p-6 shadow-[0_14px_40px_rgba(44,34,65,0.07)] lg:sticky lg:top-28">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-yellow/40"><CircleHelp className="h-7 w-7" /></div>
            <h2 className="mt-5 font-display text-2xl leading-tight">{supportTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-brand-ink/65">{supportText}</p>
            <div className="mt-6 space-y-3">
              {settings.whatsappNumber ? <Link href={buildWhatsappUrl(settings.whatsappNumber, "Hola! Tengo una pregunta sobre IQ Kids.")} target="_blank" className="flex min-h-12 items-center justify-between gap-3 rounded-full bg-brand-pink px-5 py-3 text-sm font-extrabold text-white shadow-soft transition hover:bg-[#ea737d]"><span className="inline-flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Escribinos</span><ArrowRight className="h-4 w-4" /></Link> : null}
              <Link href="/contacto" className="flex min-h-12 items-center justify-between gap-3 rounded-full border border-brand-pink/25 px-5 py-3 text-sm font-extrabold text-brand-pink transition hover:bg-brand-pink/5"><span>Ir a Contacto</span><ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
