"use client";

import { ChevronDown, ChevronUp, GripVertical, ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type HomeSlideListItem = {
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
  active: boolean;
  sortOrder: number;
};

type HomeSlidesAdminPanelProps = {
  slides: HomeSlideListItem[];
  intervalSeconds: number;
};

type HomeSlideFormState = {
  eyebrow: string;
  title: string;
  mobileTitle: string;
  subtitle: string;
  badges: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string;
  mobileImageUrl: string;
  imageAlt: string;
  active: boolean;
};

const emptyForm: HomeSlideFormState = {
  eyebrow: "",
  title: "",
  mobileTitle: "",
  subtitle: "",
  badges: "",
  ctaLabel: "",
  ctaUrl: "",
  imageUrl: "",
  mobileImageUrl: "",
  imageAlt: "",
  active: true,
};

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSize = 8 * 1024 * 1024;

function parseBadges(value: string) {
  return value
    .split("\n")
    .map((badge) => badge.trim())
    .filter(Boolean);
}

export function HomeSlidesAdminPanel({ slides, intervalSeconds }: HomeSlidesAdminPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HomeSlideFormState>(emptyForm);
  const [orderedSlides, setOrderedSlides] = useState(slides);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const dragStartOrder = useRef<string[]>([]);

  useEffect(() => {
    setOrderedSlides(slides);
  }, [slides]);

  const editingSlide = useMemo(() => slides.find((slide) => slide.id === editingId) ?? null, [slides, editingId]);
  const activeCount = slides.filter((slide) => slide.active).length;

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function loadSlide(slide: HomeSlideListItem) {
    setEditingId(slide.id);
    setForm({
      eyebrow: slide.eyebrow ?? "",
      title: slide.title,
      mobileTitle: slide.mobileTitle ?? "",
      subtitle: slide.subtitle ?? "",
      badges: slide.badges.join("\n"),
      ctaLabel: slide.ctaLabel ?? "",
      ctaUrl: slide.ctaUrl ?? "",
      imageUrl: slide.imageUrl,
      mobileImageUrl: slide.mobileImageUrl ?? "",
      imageAlt: slide.imageAlt ?? "",
      active: slide.active,
    });
    setError(null);
  }

  async function submitForm() {
    const url = editingId ? `/api/admin/home-slides/${editingId}` : "/api/admin/home-slides";
    const method = editingId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        badges: parseBadges(form.badges),
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "No pudimos guardar el slide.");
      return;
    }

    resetForm();
    router.refresh();
  }

  async function removeSlide(slideId: string) {
    if (!window.confirm("¿Eliminar este slide del carrusel?")) {
      return;
    }

    const response = await fetch(`/api/admin/home-slides/${slideId}`, {
      method: "DELETE",
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "No pudimos eliminar el slide.");
      return;
    }

    if (editingId === slideId) {
      resetForm();
    }

    router.refresh();
  }

  async function saveOrder(nextSlides: HomeSlideListItem[], previousSlides: HomeSlideListItem[]) {
    setOrderError(null);
    setIsSavingOrder(true);

    try {
      const response = await fetch("/api/admin/home-slides/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideIds: nextSlides.map((slide) => slide.id) }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setOrderedSlides(previousSlides);
        setOrderError(payload.error ?? "No pudimos guardar el orden.");
        return;
      }

      router.refresh();
    } finally {
      setIsSavingOrder(false);
    }
  }

  function moveSlide(slideId: string, offset: -1 | 1) {
    const index = orderedSlides.findIndex((slide) => slide.id === slideId);
    const target = index + offset;

    if (index < 0 || target < 0 || target >= orderedSlides.length) {
      return;
    }

    const next = [...orderedSlides];
    [next[index], next[target]] = [next[target], next[index]];
    setOrderedSlides(next);
    void saveOrder(next, orderedSlides);
  }

  function handleDragOver(overId: string) {
    if (!draggingId || draggingId === overId) {
      return;
    }

    setOrderedSlides((current) => {
      const from = current.findIndex((slide) => slide.id === draggingId);
      const to = current.findIndex((slide) => slide.id === overId);

      if (from < 0 || to < 0) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleDragEnd() {
    const previousIds = dragStartOrder.current;
    setDraggingId(null);

    if (previousIds.join() === orderedSlides.map((slide) => slide.id).join()) {
      return;
    }

    const previousSlides = previousIds
      .map((id) => orderedSlides.find((slide) => slide.id === id))
      .filter((slide): slide is HomeSlideListItem => Boolean(slide));
    void saveOrder(orderedSlides, previousSlides);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Home carrusel</p>
        <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Slides del inicio</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/70 md:text-base">
          Cada slide es una imagen de portada con su título, subtítulo, checks y botón. Todos se pueden editar, ordenar,
          pausar o borrar. Si no queda ningún slide activo, la home muestra la portada original.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="space-y-5 p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">
                {editingSlide ? "Editar slide" : "Nuevo slide"}
              </p>
              <p className="mt-2 text-sm text-brand-ink/70">Imagen, textos y botón. Los slides nuevos se agregan al final.</p>
            </div>
            {editingSlide ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4">
            <SlideImageField
              label="Imagen (escritorio)"
              hint="Horizontal, idealmente 1920×1080 o más. Dejá el lado izquierdo libre: ahí va el texto."
              url={form.imageUrl}
              onChange={(imageUrl) => setForm((current) => ({ ...current, imageUrl }))}
            />
            <SlideImageField
              label="Imagen (celular, opcional)"
              hint="Vertical. Si no la cargás, se usa la de escritorio recortada."
              url={form.mobileImageUrl}
              onChange={(mobileImageUrl) => setForm((current) => ({ ...current, mobileImageUrl }))}
            />
            <Field label="Texto alternativo de la imagen">
              <Input
                value={form.imageAlt}
                placeholder="Mamá y nena armando la vianda"
                onChange={(event) => setForm((current) => ({ ...current, imageAlt: event.target.value }))}
              />
            </Field>
            <Field label="Encabezado (texto chico arriba)">
              <Input
                value={form.eyebrow}
                placeholder="Snacks para niños"
                onChange={(event) => setForm((current) => ({ ...current, eyebrow: event.target.value }))}
              />
            </Field>
            <Field label="Título">
              <Textarea
                value={form.title}
                rows={2}
                placeholder="Entre mochilas, corridas y tuppers… por lo menos que el snack ya esté resuelto."
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </Field>
            <Field label="Título corto para celular (opcional)">
              <Input
                value={form.mobileTitle}
                placeholder="El snack ya está resuelto."
                onChange={(event) => setForm((current) => ({ ...current, mobileTitle: event.target.value }))}
              />
            </Field>
            <Field label="Subtítulo">
              <Textarea
                value={form.subtitle}
                rows={2}
                placeholder="Nutricionistas eligieron cada producto para que vos no tengas que leer etiquetas ni dudar."
                onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))}
              />
            </Field>
            <Field label="Checks (uno por línea, máximo 5)">
              <Textarea
                value={form.badges}
                rows={3}
                placeholder={"Nutricionistas\nSin sellos\nIngredientes reales"}
                onChange={(event) => setForm((current) => ({ ...current, badges: event.target.value }))}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Texto del botón">
                <Input
                  value={form.ctaLabel}
                  placeholder="Empezá con la caja mix"
                  onChange={(event) => setForm((current) => ({ ...current, ctaLabel: event.target.value }))}
                />
              </Field>
              <Field label="Link del botón">
                <Input
                  value={form.ctaUrl}
                  placeholder="/productos/caja-mix"
                  onChange={(event) => setForm((current) => ({ ...current, ctaUrl: event.target.value }))}
                />
              </Field>
            </div>
            <Checkbox
              label="Slide activo"
              checked={form.active}
              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
            />
          </div>

          {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}

          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                await submitForm();
              });
            }}
          >
            {isPending ? "Guardando..." : editingSlide ? "Guardar cambios" : "Crear slide"}
          </Button>
        </Card>

        <Card className="space-y-4 p-5 md:p-6">
          <IntervalSettings key={intervalSeconds} intervalSeconds={intervalSeconds} />

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Listado actual</p>
            <p className="mt-2 text-sm text-brand-ink/70">
              {slides.length} slides cargados, {activeCount} activos. Arrastrá un slide para cambiar el orden.
            </p>
            {isSavingOrder ? <p className="mt-2 text-sm font-bold text-brand-ink/50">Guardando orden...</p> : null}
            {orderError ? <p className="mt-2 text-sm font-bold text-red-600">{orderError}</p> : null}
          </div>

          <div className="space-y-3">
            {slides.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-brand-ink/15 p-6 text-sm text-brand-ink/55">
                Todavía no hay slides. La home muestra la portada original.
              </div>
            ) : (
              orderedSlides.map((slide, index) => {
                const isEditing = slide.id === editingId;
                const isDragging = slide.id === draggingId;

                return (
                  <div
                    key={slide.id}
                    draggable={!isSavingOrder}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", slide.id);
                      dragStartOrder.current = orderedSlides.map((entry) => entry.id);
                      setDraggingId(slide.id);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      handleDragOver(slide.id);
                    }}
                    onDrop={(event) => event.preventDefault()}
                    onDragEnd={handleDragEnd}
                    className={`cursor-grab rounded-[1.5rem] border p-4 transition active:cursor-grabbing ${
                      isEditing ? "border-brand-pink bg-brand-pink/5" : "border-brand-ink/10 bg-background"
                    } ${isDragging ? "opacity-50 ring-2 ring-brand-pink/40" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <GripVertical className="h-5 w-5 text-brand-ink/35" aria-hidden />
                        <span className="rounded-full bg-brand-peach px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-pink">
                          Posición {index + 1}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${
                            slide.active ? "bg-green-100 text-green-700" : "bg-brand-ink/10 text-brand-ink/55"
                          }`}
                        >
                          {slide.active ? "Activo" : "Pausado"}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            aria-label="Subir slide"
                            disabled={index === 0 || isSavingOrder}
                            onClick={() => moveSlide(slide.id, -1)}
                            className="rounded-md p-0.5 text-brand-ink/50 hover:text-brand-pink disabled:opacity-25"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label="Bajar slide"
                            disabled={index === orderedSlides.length - 1 || isSavingOrder}
                            onClick={() => moveSlide(slide.id, 1)}
                            className="rounded-md p-0.5 text-brand-ink/50 hover:text-brand-pink disabled:opacity-25"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                        <Button type="button" size="sm" variant="secondary" onClick={() => loadSlide(slide)}>
                          {isEditing ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => {
                            setError(null);
                            startTransition(async () => {
                              await removeSlide(slide.id);
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slide.imageUrl}
                        alt=""
                        draggable={false}
                        className="aspect-[16/9] w-full shrink-0 rounded-2xl object-cover sm:w-36"
                      />
                      <div className="min-w-0 flex-1">
                        {slide.eyebrow ? (
                          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-pink">
                            {slide.eyebrow}
                          </p>
                        ) : null}
                        <p className="mt-1 whitespace-pre-line font-bold text-brand-ink">{slide.title}</p>
                        {slide.ctaLabel ? (
                          <p className="mt-2 break-words text-sm text-brand-ink/60">
                            Botón: {slide.ctaLabel} → {slide.ctaUrl}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function IntervalSettings({ intervalSeconds }: { intervalSeconds: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(intervalSeconds));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isDirty = value !== String(intervalSeconds);

  async function save() {
    setError(null);
    setSaved(false);

    const response = await fetch("/api/admin/home-slides/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intervalSeconds: value.trim() === "" ? null : Number(value) }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "No pudimos guardar la duración.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <div className="rounded-[1.5rem] border border-brand-ink/10 bg-background p-4">
      <p className="text-sm font-bold text-brand-ink">Duración de cada slide</p>
      <p className="mt-1 text-xs text-brand-ink/55">
        Cuántos segundos se muestra cada imagen antes de pasar a la siguiente (entre 3 y 30).
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={3}
            max={30}
            value={value}
            className="w-24"
            aria-label="Segundos por slide"
            onChange={(event) => {
              setValue(event.target.value);
              setSaved(false);
            }}
          />
          <span className="text-sm font-bold text-brand-ink/70">segundos</span>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={isPending || !isDirty}
          onClick={() => {
            startTransition(async () => {
              await save();
            });
          }}
        >
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
        {saved && !isDirty ? <span className="text-sm font-bold text-green-700">Guardado.</span> : null}
      </div>
      {error ? <p className="mt-2 text-sm font-bold text-red-600">{error}</p> : null}
    </div>
  );
}

function SlideImageField({
  label,
  hint,
  url,
  onChange,
}: {
  label: string;
  hint: string;
  url: string;
  onChange: (url: string) => void;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);

    if (!allowedImageTypes.includes(file.type)) {
      setError("Usá JPG, PNG o WEBP.");
      return;
    }

    if (file.size > maxImageSize) {
      setError("La imagen supera 8 MB. Achicala antes de subirla.");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/upload/home-slide-image", { method: "POST", body });
      const payload = (await response.json()) as { data?: { publicUrl: string }; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error ?? "No se pudo subir la imagen.");
      onChange(payload.data.publicUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo subir la imagen.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm font-bold text-brand-ink/75">{label}</span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-brand-pinkSoft/25 ring-1 ring-brand-ink/10 sm:w-48 sm:shrink-0">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <label
              htmlFor={inputId}
              className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1 text-xs font-bold text-brand-ink/45 hover:text-brand-pink"
            >
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
          <input
            id={inputId}
            ref={fileRef}
            type="file"
            accept={allowedImageTypes.join(",")}
            className="hidden"
            onChange={(event) => event.target.files?.[0] && upload(event.target.files[0])}
          />
          <div className="flex flex-wrap gap-2">
            <label
              htmlFor={inputId}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:bg-brand-pinkSoft/30"
            >
              <ImagePlus className="h-4 w-4" /> {url ? "Cambiar" : "Subir"}
            </label>
            {url ? (
              <button
                type="button"
                onClick={() => onChange("")}
                className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-extrabold text-brand-ink/60 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" /> Quitar
              </button>
            ) : null}
          </div>
          <p className="text-xs leading-5 text-brand-ink/55">{hint}</p>
          {error ? (
            <p role="alert" className="text-xs font-bold text-red-600">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-brand-ink/75">{label}</span>
      {children}
    </label>
  );
}
