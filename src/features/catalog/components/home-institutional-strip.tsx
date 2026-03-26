"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { Container } from "@/components/layout/container";
import { cn } from "@/lib/utils/cn";

const slides = [
  {
    src: "/home/banana.webp",
    alt: "Ingredientes naturales y nada más",
  },
  {
    src: "/home/cacao.webp",
    alt: "IQ Kids",
  },
  {
    src: "/home/mani.webp",
    alt: "Alimentos con sentido común",
  },
];

export function HomeInstitutionalStrip() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 2200);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <section className="pb-3 pt-4 text-center md:pb-4 md:pt-8">
      <Container>
        <div className="mx-auto max-w-5xl">
          <p className="mx-auto max-w-4xl text-[1.75rem] font-extrabold leading-[1.12] tracking-[-0.02em] text-brand-ink md:text-[1.7rem] md:leading-tight md:tracking-normal">
            En IQ Kids creemos que la nutrición también se aprende, por eso nuestros productos son un paso simple y rico
            para que tus hijos desarrollen su Inteligencia Nutricional 🧠✨
          </p>
        </div>
      </Container>

      <div className="mt-8 md:hidden">
        <div className="relative overflow-hidden">
          <div
            className="flex transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {slides.map((slide) => (
              <div key={slide.src} className="min-w-full">
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  width={1200}
                  height={900}
                  className="h-auto w-full object-cover"
                  sizes="100vw"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 pb-1">
          {slides.map((slide, index) => (
            <button
              key={slide.src}
              type="button"
              aria-label={`Ver imagen ${index + 1}`}
              className={cn(
                "h-2.5 rounded-full transition-all",
                index === activeIndex ? "w-6 bg-brand-pink" : "w-2.5 bg-brand-pink/30",
              )}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </div>

      <div className="mt-10 hidden md:block">
        <div className="mx-auto max-w-[1320px] px-10 lg:max-w-[1450px] lg:px-16">
          <div className="grid grid-cols-3 gap-6 lg:gap-10">
            {slides.map((slide) => (
              <div key={slide.src} className="relative">
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  width={1400}
                  height={1100}
                  className="h-auto w-full object-contain"
                  sizes="(max-width: 1024px) 28vw, 24vw"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
