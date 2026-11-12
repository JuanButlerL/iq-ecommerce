"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

export type WholesaleHeroCarouselSlide = {
  id: string;
  // Foto de fondo opcional; sin foto se usa el fondo rosado de la portada.
  background: { imageUrl: string; mobileImageUrl: string; alt: string; overlay: boolean } | null;
  // Si el slide es solo una imagen con link, toda la superficie es clickeable.
  href?: string | null;
  label?: string;
  content: ReactNode;
};

const SWIPE_THRESHOLD_PX = 50;

// Mismo comportamiento que el carrusel de la home minorista: fundido, pausa al pasar el mouse,
// swipe en el celular y sin movimiento si el sistema pide reducir animaciones.
export function WholesaleHeroCarousel({ slides, intervalSeconds = 7 }: { slides: WholesaleHeroCarouselSlide[]; intervalSeconds?: number }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const hasMultipleSlides = slides.length > 1;

  const goTo = useCallback((index: number) => setActiveIndex((index + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!hasMultipleSlides || isPaused || prefersReducedMotion) return;
    const timer = window.setTimeout(() => goTo(activeIndex + 1), intervalSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [activeIndex, goTo, hasMultipleSlides, intervalSeconds, isPaused, prefersReducedMotion]);

  return (
    <section
      className="relative overflow-hidden bg-[#fff6f7]"
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
        if (!hasMultipleSlides || startX == null || endX == null) return;
        const delta = endX - startX;
        if (Math.abs(delta) >= SWIPE_THRESHOLD_PX) goTo(activeIndex + (delta < 0 ? 1 : -1));
      }}
    >
      <div className="grid">
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;

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
              {slide.background ? (
                <div className="absolute inset-0">
                  <picture>
                    {slide.background.mobileImageUrl ? <source media="(max-width: 639px)" srcSet={slide.background.mobileImageUrl} /> : null}
                    {/* eslint-disable-next-line @next/next/no-img-element -- mismas fotos que sube el admin, sin optimizador. */}
                    <img
                      src={slide.background.imageUrl}
                      alt={slide.background.alt}
                      loading={index === 0 ? "eager" : "lazy"}
                      fetchPriority={index === 0 ? "high" : undefined}
                      className="absolute inset-0 h-full w-full object-cover object-center"
                    />
                  </picture>
                  {slide.background.overlay ? (
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(255,246,247,0.9)_0%,rgba(255,246,247,0.78)_45%,rgba(255,246,247,0.45)_100%)]" />
                  ) : null}
                </div>
              ) : (
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(244,137,145,0.18)_0%,transparent_70%)]" />
              )}
              {slide.href ? <a href={slide.href} aria-label={slide.label || "Ver más"} className="absolute inset-0 z-[1]" /> : null}
              <div className={cn("relative flex flex-1 flex-col justify-center", slide.href && "pointer-events-none")}>{slide.content}</div>
            </div>
          );
        })}
      </div>

      {hasMultipleSlides ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex items-center justify-center sm:bottom-6">
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
