import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { barBasics, barFacts, listNutritionists, nutritionists, NUTRITIONISTS_PATH } from "@/features/nutritionists/data";
import { getStoreSettings } from "@/features/settings/queries";
import { absoluteUrl, JsonLd } from "@/lib/seo/json-ld";
import { siteConfig } from "@/lib/utils/site";

export const metadata: Metadata = {
  title: "Nutricionistas que eligieron IQ Kids",
  description: `Las barritas ${siteConfig.name} fueron elegidas por un equipo de nutricionistas con matrícula nacional: ${listNutritionists()}.`,
  alternates: { canonical: NUTRITIONISTS_PATH },
};

const LAST_UPDATED = "noviembre de 2026";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-28 border-t border-brand-ink/10 pt-8">
      <h2 id={`${id}-heading`} className="font-display text-2xl leading-tight sm:text-3xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-brand-ink/75 sm:text-base">{children}</div>
    </section>
  );
}

export default async function NutritionistsPage() {
  const settings = await getStoreSettings();
  const pageUrl = absoluteUrl(NUTRITIONISTS_PATH);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: "Nutricionistas que eligieron IQ Kids",
    inLanguage: "es-AR",
    isPartOf: { "@id": absoluteUrl("/#website") },
    about: { "@id": absoluteUrl("/#organization") },
    reviewedBy: nutritionists.map((person) => ({
      "@type": "Person",
      name: person.name,
      jobTitle: "Nutricionista",
      identifier: {
        "@type": "PropertyValue",
        name: "Matrícula Nacional",
        value: person.license.replace(/^MN\s*/, ""),
      },
    })),
  };

  return (
    <div className="min-h-screen bg-white text-brand-ink">
      <JsonLd data={structuredData} />
      <header className="mx-auto max-w-[900px] px-5 pb-6 pt-9 sm:px-8 sm:pt-12 lg:pt-14">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-pink sm:text-xs">Respaldo profesional</p>
        <h1 className="mt-4 font-display text-[2.3rem] leading-[1.02] sm:text-[3.15rem]">
          El equipo de nutricionistas detrás de <span className="text-brand-pink">IQ Kids.</span>
        </h1>
        {/* Answer-first: a self-contained summary an AI engine can quote on its own. */}
        <p className="mt-4 max-w-2xl text-base leading-7 text-brand-ink/75 sm:text-lg sm:leading-8">
          Las barritas {siteConfig.name} fueron elegidas por un equipo de cuatro nutricionistas con matrícula nacional:{" "}
          {listNutritionists()}. Son barritas de {barBasics.portion} para chicos {barBasics.recommendedAge}, hechas con
          dátiles, pasas de uva y harina de almendra como base y endulzadas solo con esas frutas.
        </p>
        <p className="mt-3 text-xs text-brand-ink/50">Última actualización: {LAST_UPDATED}</p>
      </header>

      <main className="mx-auto max-w-[900px] space-y-8 px-5 pb-16 sm:px-8 lg:pb-20">
        <Section id="equipo" title="Quiénes son">
          <p>
            Este equipo eligió cada producto que vendemos antes de que llegara a la tienda. Así no tenés que leer etiquetas ni
            comparar ingredientes: alguien que sabe ya lo hizo por vos.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {nutritionists.map((person) => (
              <li key={person.license} className="rounded-[1.5rem] bg-brand-peach/60 px-5 py-4">
                <p className="font-bold text-brand-ink">{person.name}</p>
                <p className="mt-1 text-sm text-brand-ink/65">Nutricionista · Matrícula Nacional {person.license.replace(/^MN\s*/, "")}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="barritas" title="Qué tiene cada barrita">
          <p>
            Todas las barritas pesan {barBasics.portion}, están pensadas para chicos {barBasics.recommendedAge} y tienen una
            vida útil de {barBasics.shelfLife}. Estos son sus ingredientes, en el orden de la receta:
          </p>
          <div className="grid gap-4">
            {barFacts.map((bar) => (
              <article key={bar.flavor} className="rounded-[1.5rem] border border-brand-ink/10 px-5 py-4">
                <h3 className="font-bold text-brand-ink">Barrita de {bar.flavor}</h3>
                <p className="mt-2">
                  <strong className="text-brand-ink">Ingredientes:</strong> {bar.ingredients.join(", ")}.
                </p>
                <p className="mt-1">
                  <strong className="text-brand-ink">Alérgenos:</strong> {bar.allergens}
                </p>
              </article>
            ))}
          </div>
          <p>
            La información nutricional completa de cada sabor está en su ficha, en{" "}
            <Link href="/productos" className="font-bold text-brand-pink">
              Productos
            </Link>
            .
          </p>
        </Section>

        <Section id="consultas" title="¿Tenés dudas?">
          <p>
            Si tu hijo o hija tiene alguna indicación médica o alimentaria particular, consultalo siempre con su pediatra o
            nutricionista de cabecera.
            {settings?.faqSectionEnabled ? (
              <>
                {" "}También podés revisar nuestras{" "}
                <Link href="/preguntas-frecuentes" className="font-bold text-brand-pink">
                  preguntas frecuentes
                </Link>
                .
              </>
            ) : null}{" "}
            Y si querés hablar con nosotros, escribinos desde{" "}
            <Link href="/contacto" className="font-bold text-brand-pink">
              contacto
            </Link>
            .
          </p>
        </Section>
      </main>
    </div>
  );
}
