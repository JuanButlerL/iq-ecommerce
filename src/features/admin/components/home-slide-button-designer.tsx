"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BannerFrame, DEFAULT_SLIDE_BUTTON, type SlideButton } from "@/features/home-slides/components/banner-slide";
import { cn } from "@/lib/utils/cn";

// Colores rápidos: los de la marca y los más usados en banners.
const COLOR_PRESETS = [
  { name: "Amarillo", value: "#ffd35c" },
  { name: "Rosa", value: "#F48991" },
  { name: "Blanco", value: "#ffffff" },
  { name: "Negro", value: "#111111" },
  { name: "Violeta IQ", value: "#2c2241" },
  { name: "Celeste", value: "#7bd8f7" },
];

const POSITION_PRESETS: { label: string; x: number; y: number }[] = [
  { label: "↖", x: 20, y: 20 },
  { label: "↑", x: 50, y: 20 },
  { label: "↗", x: 80, y: 20 },
  { label: "←", x: 20, y: 50 },
  { label: "•", x: 50, y: 50 },
  { label: "→", x: 80, y: 50 },
  { label: "↙", x: 20, y: 80 },
  { label: "↓", x: 50, y: 80 },
  { label: "↘", x: 80, y: 80 },
];

// Diseñador del botón del banner: se ve en vivo sobre la imagen; un clic en la imagen lo ubica.
export function HomeSlideButtonDesigner({
  imageUrl,
  mobileImageUrl,
  value,
  onChange,
}: {
  imageUrl: string;
  mobileImageUrl: string;
  value: SlideButton | null;
  onChange: (value: SlideButton | null) => void;
}) {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const mobile = view === "mobile";
  const button = value;
  const set = (patch: Partial<SlideButton>) => button && onChange({ ...button, ...patch });
  const place = (x: number, y: number) => set(mobile ? { mobileX: x, mobileY: y } : { x, y });
  const previewImage = mobile ? mobileImageUrl || imageUrl : imageUrl;

  if (!button) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-brand-ink/20 bg-background p-4">
        <p className="text-sm font-bold text-brand-ink">Botón sobre la imagen</p>
        <p className="mt-1 text-xs text-brand-ink/55">
          Sin botón, si cargás un link abajo toda la imagen es clickeable. Con botón, lo ubicás y lo pintás como quieras.
        </p>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_SLIDE_BUTTON })}
          className="mt-3 rounded-full bg-brand-pink px-4 py-2 text-sm font-extrabold text-white hover:opacity-90"
        >
          + Agregar botón
        </button>
      </div>
    );
  }

  const x = mobile ? button.mobileX : button.x;
  const y = mobile ? button.mobileY : button.y;
  const size = mobile ? button.mobileSize : button.size;

  return (
    <div className="space-y-4 rounded-[1.5rem] border border-brand-ink/10 bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-brand-ink">Botón sobre la imagen</p>
        <button type="button" onClick={() => onChange(null)} className="text-xs font-extrabold text-brand-ink/55 hover:text-red-600">
          Quitar botón
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-brand-ink/70">Texto (Enter = otra línea)</span>
          <Textarea rows={2} value={button.label} onChange={(e) => set({ label: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-brand-ink/70">Link al tocarlo</span>
          <Input value={button.url} placeholder="/productos" onChange={(e) => set({ url: e.target.value })} />
          <span className="mt-1 block text-[11px] text-brand-ink/50">Ej: /productos, /productos/caja-mix o una dirección completa.</span>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ColorField label={button.outline ? "Color del borde y del texto" : "Color del botón"} value={button.outline ? button.textColor : button.bgColor} onChange={(c) => set(button.outline ? { textColor: c } : { bgColor: c })} />
        {!button.outline ? <ColorField label="Color del texto" value={button.textColor} onChange={(c) => set({ textColor: c })} /> : null}
      </div>

      <div className="flex flex-wrap gap-2 text-xs font-bold">
        <Toggle active={!button.outline} onClick={() => set({ outline: false })}>Relleno</Toggle>
        <Toggle active={button.outline} onClick={() => set({ outline: true })}>Solo borde</Toggle>
        <span className="mx-1 w-px bg-brand-ink/10" />
        <Toggle active={button.shape === "rounded"} onClick={() => set({ shape: "rounded" })}>Esquinas redondeadas</Toggle>
        <Toggle active={button.shape === "pill"} onClick={() => set({ shape: "pill" })}>Píldora</Toggle>
      </div>

      <div className="flex gap-2">
        <Toggle active={!mobile} onClick={() => setView("desktop")}>
          <Monitor className="h-3.5 w-3.5" /> Escritorio
        </Toggle>
        <Toggle active={mobile} onClick={() => setView("mobile")}>
          <Smartphone className="h-3.5 w-3.5" /> Celular
        </Toggle>
      </div>

      <div className={cn("overflow-hidden rounded-2xl ring-1 ring-brand-ink/10", mobile ? "mx-auto max-w-[260px]" : "")}>
        {previewImage ? (
          <BannerFrame imageUrl={previewImage} alt="" button={button} mobile={mobile} interactive={false} onPick={place} />
        ) : (
          <p className="p-6 text-center text-sm text-brand-ink/50">Subí la imagen para ubicar el botón.</p>
        )}
      </div>
      <p className="-mt-2 text-xs text-brand-ink/55">
        Tocá la imagen donde querés el botón ({mobile ? "celular" : "escritorio"}). {mobile && !mobileImageUrl ? "Sin imagen de celular se usa la de escritorio completa." : ""}
      </p>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
        <div className="grid w-fit grid-cols-3 gap-1">
          {POSITION_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              title="Ubicar acá"
              onClick={() => place(preset.x, preset.y)}
              className={cn(
                "h-8 w-8 rounded-lg border text-sm font-bold",
                x === preset.x && y === preset.y ? "border-brand-pink bg-brand-pink text-white" : "border-brand-ink/15 bg-white text-brand-ink/60 hover:border-brand-pink",
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <Slider label="Tamaño" value={size} min={1} max={10} step={0.5} onChange={(v) => set(mobile ? { mobileSize: v } : { size: v })} />
          <Slider label="Horizontal" value={x} min={0} max={100} step={1} suffix="%" onChange={(v) => place(v, y)} />
          <Slider label="Vertical" value={y} min={0} max={100} step={1} suffix="%" onChange={(v) => place(x, v)} />
        </div>
      </div>
      {mobile ? (
        <button
          type="button"
          onClick={() => set({ mobileX: button.x, mobileY: button.y, mobileSize: button.size })}
          className="text-xs font-extrabold text-brand-ink/60 hover:text-brand-pink"
        >
          Copiar posición y tamaño de escritorio
        </button>
      ) : null}
    </div>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold transition",
        active ? "border-brand-ink bg-brand-ink text-white" : "border-brand-ink/15 bg-white text-brand-ink/70 hover:border-brand-ink/40",
      )}
    >
      {children}
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-bold text-brand-ink/70">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            title={preset.name}
            onClick={() => onChange(preset.value)}
            className={cn("h-7 w-7 rounded-full border-2", value.toLowerCase() === preset.value.toLowerCase() ? "border-brand-pink" : "border-brand-ink/15")}
            style={{ backgroundColor: preset.value }}
          />
        ))}
        <label className="relative ml-1 inline-flex h-7 items-center gap-1 rounded-full border border-brand-ink/15 bg-white px-2 text-[11px] font-bold text-brand-ink/60">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0" />
          Otro
        </label>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 text-xs font-bold text-brand-ink/70">
      <span className="w-20 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-brand-pink" />
      <span className="w-10 shrink-0 text-right tabular-nums">
        {value}
        {suffix}
      </span>
    </label>
  );
}
