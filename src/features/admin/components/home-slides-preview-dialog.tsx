"use client";

import { Monitor, Smartphone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import type { HomeHeroSlide } from "@/features/home-slides/components/home-hero-carousel";
import { HOME_CAROUSEL_PREVIEW_PATH, type HomeCarouselPreviewMessage } from "@/features/home-slides/lib/hero-slides";
import { cn } from "@/lib/utils/cn";

const viewports = {
  desktop: { label: "Escritorio", width: 1440, icon: Monitor },
  mobile: { label: "Celular", width: 390, icon: Smartphone },
} as const;

type Viewport = keyof typeof viewports;

type HomeSlidesPreviewDialogProps = {
  slides: HomeHeroSlide[];
  initialIndex: number;
  // datetime-local value (Argentina time) the home is simulated at.
  previewAt: string;
  onPreviewAtChange: (value: string) => void;
  notice: string | null;
  onClose: () => void;
};

export function HomeSlidesPreviewDialog({
  slides,
  initialIndex,
  previewAt,
  onPreviewAtChange,
  notice,
  onClose,
}: HomeSlidesPreviewDialogProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [frameHeight, setFrameHeight] = useState(720);
  const [stageWidth, setStageWidth] = useState(0);
  const [isFrameReady, setIsFrameReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameWidth = viewports[viewport].width;
  const scale = stageWidth > 0 ? Math.min(1, stageWidth / frameWidth) : 1;

  useEffect(() => {
    function handleMessage(event: MessageEvent<HomeCarouselPreviewMessage>) {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (event.data?.type === "home-carousel-preview:ready") setIsFrameReady(true);
      if (event.data?.type === "home-carousel-preview:height") setFrameHeight(event.data.height);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!isFrameReady) return;

    const message: HomeCarouselPreviewMessage = { type: "home-carousel-preview:slides", slides, initialIndex };
    iframeRef.current?.contentWindow?.postMessage(message, window.location.origin);
  }, [isFrameReady, slides, initialIndex]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const observer = new ResizeObserver(() => setStageWidth(stage.clientWidth));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Vista previa del carrusel"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-ink/60 p-3 sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-6xl space-y-4 rounded-[1.75rem] bg-white p-4 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Vista previa</p>
            <p className="mt-1 text-sm text-brand-ink/70">
              Así se ve el carrusel de la home con este slide. Todavía no se guardó nada.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar vista previa"
            onClick={onClose}
            className="rounded-full p-2 text-brand-ink/60 hover:bg-brand-ink/5 hover:text-brand-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex rounded-full bg-brand-ink/5 p-1">
            {(Object.keys(viewports) as Viewport[]).map((key) => {
              const { label, icon: Icon } = viewports[key];

              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={viewport === key}
                  onClick={() => setViewport(key)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-extrabold transition",
                    viewport === key ? "bg-white text-brand-ink shadow-card" : "text-brand-ink/55 hover:text-brand-ink",
                  )}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              );
            })}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-brand-ink/60">Ver la home como el (hora de Argentina)</span>
            <Input
              type="datetime-local"
              value={previewAt}
              className="w-56"
              onChange={(event) => event.target.value && onPreviewAtChange(event.target.value)}
            />
          </label>
        </div>

        {notice ? <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{notice}</p> : null}

        <div ref={stageRef} className="w-full">
          <div
            className="mx-auto overflow-hidden rounded-2xl ring-1 ring-brand-ink/10"
            style={{ width: frameWidth * scale, height: frameHeight * scale }}
          >
            <iframe
              ref={iframeRef}
              src={HOME_CAROUSEL_PREVIEW_PATH}
              title="Vista previa del carrusel de la home"
              className="origin-top-left border-0 bg-white"
              style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})` }}
            />
          </div>
        </div>

        {slides.length > 1 ? (
          <p className="text-xs text-brand-ink/55">
            En la vista previa los slides no pasan solos: usá los puntitos de abajo para recorrerlos.
          </p>
        ) : null}
      </div>
    </div>
  );
}
