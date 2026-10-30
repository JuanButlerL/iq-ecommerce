"use client";

import { useEffect, useRef, useState } from "react";

import { HomeHeroCarousel, type HomeHeroSlide } from "@/features/home-slides/components/home-hero-carousel";
import type { HomeCarouselPreviewMessage } from "@/features/home-slides/lib/hero-slides";

type HomeCarouselPreviewFrameProps = {
  footnote: string | null;
  intervalSeconds: number;
};

// Runs inside the admin preview iframe: the parent sends the draft slides, this renders the real carousel.
export function HomeCarouselPreviewFrame({ footnote, intervalSeconds }: HomeCarouselPreviewFrameProps) {
  const [preview, setPreview] = useState<{ slides: HomeHeroSlide[]; initialIndex: number; version: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const post = (message: HomeCarouselPreviewMessage) => window.parent.postMessage(message, window.location.origin);

    function handleMessage(event: MessageEvent<HomeCarouselPreviewMessage>) {
      if (event.origin !== window.location.origin || event.data?.type !== "home-carousel-preview:slides") {
        return;
      }

      const { slides, initialIndex } = event.data;
      setPreview((current) => ({ slides, initialIndex, version: (current?.version ?? 0) + 1 }));
    }

    window.addEventListener("message", handleMessage);
    post({ type: "home-carousel-preview:ready" });

    const container = containerRef.current;
    const observer = new ResizeObserver(() => {
      if (container) post({ type: "home-carousel-preview:height", height: container.offsetHeight });
    });
    if (container) observer.observe(container);

    return () => {
      window.removeEventListener("message", handleMessage);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="bg-white text-brand-ink">
      {preview ? (
        <HomeHeroCarousel
          // Remount on every update so the carousel starts on the slide being edited.
          key={preview.version}
          slides={preview.slides}
          footnote={footnote}
          intervalSeconds={intervalSeconds}
          initialIndex={preview.initialIndex}
          autoPlay={false}
        />
      ) : (
        <div className="flex min-h-[560px] items-center justify-center text-sm font-bold text-brand-ink/50">
          Cargando vista previa...
        </div>
      )}
    </div>
  );
}
