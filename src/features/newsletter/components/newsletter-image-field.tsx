"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const maxSize = 5 * 1024 * 1024;

export function NewsletterImageField({
  url,
  alt,
  folder,
  onChange,
  label = "Imagen",
  compact = false,
}: {
  url: string;
  alt: string;
  folder: string;
  onChange: (value: { url: string; alt: string }) => void;
  label?: string;
  compact?: boolean;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);

    if (!allowedTypes.includes(file.type)) {
      setError("Usá JPG, PNG o WEBP.");
      return;
    }

    if (file.size > maxSize) {
      setError("La imagen supera 5 MB. Achicala antes de subirla.");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("folder", folder);
      const response = await fetch("/api/admin/upload/newsletter-image", { method: "POST", body });
      const payload = (await response.json()) as { data?: { publicUrl: string }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "No se pudo subir la imagen.");
      onChange({ url: payload.data.publicUrl, alt });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <span className="block text-sm font-bold">{label}</span>
      <div className={cn("flex gap-3", compact ? "flex-col" : "flex-col sm:flex-row sm:items-start")}>
        <div className={cn("relative overflow-hidden rounded-2xl bg-brand-pinkSoft/25 ring-1 ring-brand-ink/10", compact ? "aspect-[4/3] w-full" : "aspect-[4/3] w-full sm:w-44 sm:shrink-0")}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={alt} className="h-full w-full object-cover" />
          ) : (
            <label htmlFor={inputId} className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-xs font-bold text-brand-ink/45 hover:text-brand-pink">
              <ImagePlus className="h-6 w-6" /> Subir imagen
            </label>
          )}
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70">
              <Loader2 className="h-6 w-6 animate-spin text-brand-pink" />
            </div>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input id={inputId} ref={fileRef} type="file" accept={allowedTypes.join(",")} className="hidden" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])} />
          <div className="flex flex-wrap gap-2">
            <label htmlFor={inputId} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:bg-brand-pinkSoft/30">
              <ImagePlus className="h-4 w-4" /> {url ? "Cambiar" : "Subir"}
            </label>
            {url ? (
              <button type="button" onClick={() => onChange({ url: "", alt })} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-extrabold text-brand-ink/60 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="h-4 w-4" /> Quitar
              </button>
            ) : null}
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-brand-ink/60">Texto alternativo (qué muestra la imagen)</span>
            <Input value={alt} onChange={(event) => onChange({ url, alt: event.target.value })} maxLength={200} placeholder="Ej: Chicos compartiendo la merienda en el recreo" />
          </label>
          {error ? <p role="alert" className="text-xs font-bold text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
