import Link from "next/link";

import type { WholesalePortadaSlide } from "@/features/wholesale/components/wholesale-hero-carousel";
import type { WholesaleContent } from "@/features/wholesale/content";
import { cn } from "@/lib/utils/cn";

export const wholesalePrimaryCta =
  "inline-flex items-center justify-center rounded-full bg-brand-pink px-7 py-4 text-base font-extrabold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#ea737d]";
export const wholesaleSecondaryCta =
  "inline-flex items-center justify-center rounded-full bg-white px-7 py-4 text-base font-extrabold text-brand-ink ring-2 ring-brand-ink/10 transition hover:ring-brand-ink/30";

// La portada de siempre de /mayoristas (con foto de fondo opcional). Es el primer slide del carrusel;
// la usan la página y la vista previa del admin, así las dos se ven igual.
export function buildWholesalePortadaSlide({
  hero,
  showProducts,
  hasMoreSlides,
}: {
  hero: WholesaleContent["hero"];
  showProducts: boolean;
  // Con más slides se deja lugar abajo para los puntitos.
  hasMoreSlides: boolean;
}): WholesalePortadaSlide {
  const heroSlidePadding = cn("px-4 pb-14 pt-14 text-center md:px-6 md:pb-20 md:pt-20", hasMoreSlides && "pb-20 md:pb-24");
  const primaryCta = wholesalePrimaryCta;
  const secondaryCta = wholesaleSecondaryCta;

  return {
    kind: "portada",
    id: "portada",
    background: hero.backgroundImageUrl
      ? { imageUrl: hero.backgroundImageUrl, mobileImageUrl: hero.backgroundMobileImageUrl, alt: "", overlay: true }
      : null,
    content: (
      <div className={heroSlidePadding}>
        <div className="relative mx-auto max-w-[820px]">
          {hero.eyebrow ? <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-pink">{hero.eyebrow}</p> : null}
          <h1 className="mt-5 whitespace-pre-line text-balance font-display text-[2.6rem] leading-[1.02] text-brand-ink md:text-[4.2rem]">
            {hero.title}
            {hero.titleAccent ? <span className="mt-3 block text-[0.55em] leading-[1.15] text-brand-pink">{hero.titleAccent}</span> : null}
          </h1>
          {hero.description ? (
            <p className="mx-auto mt-6 max-w-[620px] whitespace-pre-line text-base leading-7 text-brand-ink/70 md:text-lg md:leading-8">{hero.description}</p>
          ) : null}
          {hero.chips.length > 0 ? (
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              {hero.chips.map((chip, index) => (
                <span
                  key={`${chip.label}-${index}`}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-bold",
                    chip.accent ? "bg-brand-pink text-white" : "bg-white text-brand-ink ring-1 ring-brand-ink/10",
                  )}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/mayoristas/registro" className={primaryCta}>
              {hero.primaryCta}
            </Link>
            {showProducts ? (
              <a href="#productos" className={secondaryCta}>
                {hero.secondaryCta}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    ),
  };
}
