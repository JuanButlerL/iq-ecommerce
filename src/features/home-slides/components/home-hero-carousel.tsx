"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils/cn";

export type HomeHeroSlide = {
  id: string;
  eyebrow: string | null;
  title: string;
  mobileTitle: string | null;
  subtitle: string | null;
  badges: string[];
  ctaLabel: string | null;
  ctaUrl: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  imageAlt: string | null;
  // Soft wash behind the text (on unless the slide turns it off).
  imageOverlay?: boolean;
  // Framing override for the original hero photo; uploaded slides use the default.
  imageClassName?: string;
};

type HomeHeroCarouselProps = {
  slides: HomeHeroSlide[];
  footnote?: string | null;
  intervalSeconds?: number;
  initialIndex?: number;
  autoPlay?: boolean;
};

const SWIPE_THRESHOLD_PX = 50;
const defaultImageClassName = "absolute inset-0 h-full w-full object-cover object-[72%_center] sm:object-[76%_center]";
// Image-only slides (text baked into the artwork) are shown whole-centered, without the text wash.
const imageOnlyClassName = "absolute inset-0 h-full w-full object-cover object-center";

export function HomeHeroCarousel({
  slides,
  footnote,
  intervalSeconds = 7,
  initialIndex = 0,
  autoPlay = true,
}: HomeHeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(() => Math.min(Math.max(initialIndex, 0), slides.length - 1));
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const hasMultipleSlides = slides.length > 1;

  const goTo = useCallback(
    (index: number) => {
      setActiveIndex((index + slides.length) % slides.length);
    },
    [slides.length],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!autoPlay || !hasMultipleSlides || isPaused || prefersReducedMotion) {
      return;
    }

    const timer = window.setTimeout(() => goTo(activeIndex + 1), intervalSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, autoPlay, goTo, hasMultipleSlides, intervalSeconds, isPaused, prefersReducedMotion]);

  return (
    <section
      id="inicio"
      className="relative overflow-hidden"
      aria-roledescription={hasMultipleSlides ? "carrusel" : undefined}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const startX = touchStartX.current;
        const endX = event.changedTouches[0]?.clientX;
        touchStartX.current = null;

        if (!hasMultipleSlides || startX == null || endX == null) {
          return;
        }

        const delta = endX - startX;
        if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) {
          goTo(activeIndex + (delta < 0 ? 1 : -1));
        }
      }}
    >
      <div className="grid">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          const TitleTag = index === 0 ? "h1" : "h2";
          const hasButton = Boolean(slide.ctaLabel && slide.ctaUrl);
          const hasText = Boolean(slide.title || slide.eyebrow || slide.subtitle || slide.badges.length > 0 || hasButton);
          const showOverlay = hasText && slide.imageOverlay !== false;
          // A link without button text makes the whole slide clickable (typical for promo banners).
          const slideHref = !slide.ctaLabel && slide.ctaUrl ? slide.ctaUrl : null;

          return (
            <div
              key={slide.id}
              className={cn(
                "relative col-start-1 row-start-1 flex flex-col transition-opacity duration-700 ease-out motion-reduce:transition-none",
                isActive ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0",
              )}
              aria-hidden={isActive ? undefined : true}
              inert={isActive ? undefined : true}
              role={hasMultipleSlides ? "group" : undefined}
              aria-roledescription={hasMultipleSlides ? "slide" : undefined}
              aria-label={hasMultipleSlides ? `${index + 1} de ${slides.length}` : undefined}
            >
              <div className="absolute inset-0">
                <picture>
                  {slide.mobileImageUrl ? <source media="(max-width: 639px)" srcSet={slide.mobileImageUrl} /> : null}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.imageUrl}
                    alt={slide.imageAlt ?? ""}
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : undefined}
                    className={hasText ? (slide.imageClassName ?? defaultImageClassName) : imageOnlyClassName}
                  />
                </picture>
                {showOverlay ? (
                  <>
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,249,250,0.28)_0%,rgba(255,249,250,0.22)_48%,rgba(255,249,250,0.16)_78%,rgba(255,249,250,0.1)_100%)] md:bg-[linear-gradient(90deg,rgba(255,248,250,0.94)_0%,rgba(255,248,250,0.86)_28%,rgba(255,248,250,0.62)_45%,rgba(255,248,250,0.18)_65%,rgba(255,248,250,0)_78%)]" />
                    <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(123,216,247,0.12),rgba(255,255,255,0))]" />
                    <div className="absolute inset-y-0 right-0 w-24 bg-[linear-gradient(270deg,rgba(255,211,92,0.12),rgba(255,255,255,0))] sm:w-40" />
                    <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_at_83%_5%,rgba(44,34,65,0.24)_0%,rgba(44,34,65,0.13)_18%,rgba(44,34,65,0.04)_34%,transparent_48%)] lg:block" />
                  </>
                ) : null}
              </div>
              {slideHref ? (
                <Link
                  href={slideHref}
                  aria-label={slide.imageAlt || slide.title || "Ver más"}
                  className="absolute inset-0 z-[1]"
                />
              ) : null}

              <div className="relative mx-auto flex w-full max-w-[1600px] flex-1 px-0 pb-0 pt-0 sm:px-6 sm:pb-14 sm:pt-6 lg:px-10 lg:pb-24 lg:pt-14 xl:px-12">
                <div className="flex min-h-[560px] w-full max-w-[860px] flex-col justify-stretch sm:min-h-[620px] sm:justify-center lg:min-h-[610px] xl:min-h-[640px] xl:max-w-[980px]">
                  <div className="relative flex min-h-[560px] w-full flex-1 flex-col justify-center px-8 sm:flex-initial py-10 sm:mx-0 sm:min-h-0 sm:max-w-none sm:p-0">
                    {hasText ? (
                      <>
                        {showOverlay ? (
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.8)_0%,rgba(255,255,255,0.72)_100%)] shadow-[0_14px_34px_rgba(255,255,255,0.18)] backdrop-blur-[2px] sm:hidden" />
                        ) : null}
                        {slide.eyebrow ? (
                          <p className="relative mb-4 text-sm font-extrabold uppercase tracking-[0.28em] text-brand-pink">
                            {slide.eyebrow}
                          </p>
                        ) : null}
                        {slide.title ? (
                          <TitleTag className="relative max-w-[860px] whitespace-pre-line font-display text-[2.45rem] leading-[0.97] text-brand-ink sm:text-[4.15rem] lg:max-w-[820px] lg:text-[4.25rem] xl:text-[4.45rem]">
                            {slide.mobileTitle ? (
                              <>
                                <span className="sm:hidden">{slide.mobileTitle}</span>
                                <span className="hidden sm:inline">{slide.title}</span>
                              </>
                            ) : (
                              slide.title
                            )}
                          </TitleTag>
                        ) : null}
                        {slide.subtitle ? (
                          <p className="relative mt-5 max-w-[760px] whitespace-pre-line text-[1.05rem] leading-8 text-brand-ink/80 sm:text-xl sm:leading-8">
                            {slide.subtitle}
                          </p>
                        ) : null}
                        {slide.badges.length > 0 ? (
                          <div className="relative mt-8 flex flex-wrap gap-3 text-sm font-bold text-brand-ink">
                            {slide.badges.map((badge) => (
                              <span key={badge} className="rounded-full bg-white px-4 py-2 shadow-card">
                                ✓ {badge}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {hasButton || footnote ? (
                          <div className="relative mt-10 flex flex-col items-start gap-4">
                            {hasButton && slide.ctaUrl ? (
                              <Link
                                href={slide.ctaUrl}
                                className="inline-flex w-full max-w-[420px] items-center justify-center rounded-full bg-brand-pink px-8 py-5 text-center text-lg font-extrabold text-white shadow-soft transition hover:bg-[#ea737d] sm:w-auto sm:max-w-none sm:px-10"
                              >
                                {slide.ctaLabel}
                              </Link>
                            ) : null}
                            {footnote ? <p className="text-sm font-bold text-brand-ink/70">{footnote}</p> : null}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasMultipleSlides ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 mx-auto flex max-w-[1600px] items-center justify-center gap-4 sm:bottom-6">
          <div className="pointer-events-auto flex items-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Ir al slide ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => goTo(index)}
                className={cn(
                  "h-2.5 rounded-full shadow-card transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/50",
                  index === activeIndex ? "w-8 bg-brand-pink" : "w-2.5 bg-white/90 hover:bg-white",
                )}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
