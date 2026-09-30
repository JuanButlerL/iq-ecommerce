"use client";

import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { NewsletterFormattedTextarea } from "@/features/newsletter/components/newsletter-formatted-textarea";
import { NewsletterImageField } from "@/features/newsletter/components/newsletter-image-field";
import {
  NEWSLETTER_ACCENT_TONES,
  NEWSLETTER_ACCENT_TONE_LABELS,
  NEWSLETTER_BLOCK_LABELS,
  NEWSLETTER_STEP_MARKERS,
  NEWSLETTER_STEP_MARKER_LABELS,
  NEWSLETTER_TIP_TONES,
  NEWSLETTER_TIP_TONE_LABELS,
  createBlockId,
  type NewsletterAccentTone,
  type NewsletterBlock,
  type NewsletterProductSummary,
} from "@/features/newsletter/content";

export type NewsletterTestimonialOption = { id: string; name: string; roleLabel: string | null; quote: string };

function ToneSelect({ value, onChange }: { value: NewsletterAccentTone | undefined; onChange: (tone: NewsletterAccentTone) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">Color</span>
      <Select value={value ?? "pink"} onChange={(event) => onChange(event.target.value as NewsletterAccentTone)}>
        {NEWSLETTER_ACCENT_TONES.map((tone) => (
          <option key={tone} value={tone}>
            {NEWSLETTER_ACCENT_TONE_LABELS[tone]}
          </option>
        ))}
      </Select>
    </label>
  );
}
import { formatArs } from "@/lib/utils/currency";

const fieldLabel = "mb-2 block text-sm font-bold";

export function NewsletterBlockEditor({
  block,
  index,
  total,
  folder,
  products,
  testimonials,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  block: NewsletterBlock;
  index: number;
  total: number;
  folder: string;
  products: NewsletterProductSummary[];
  testimonials: NewsletterTestimonialOption[];
  onChange: (block: NewsletterBlock) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const iconButton = "inline-flex h-9 w-9 items-center justify-center rounded-xl text-brand-ink/55 transition hover:bg-brand-pinkSoft/40 hover:text-brand-ink disabled:pointer-events-none disabled:opacity-30";

  return (
    <div className="rounded-[1.5rem] border border-brand-ink/10 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-pink">
          {index + 1}. {NEWSLETTER_BLOCK_LABELS[block.type]}
        </p>
        <div className="flex items-center gap-0.5">
          <button type="button" className={iconButton} onClick={() => onMove(-1)} disabled={index === 0} aria-label="Subir bloque" title="Subir">
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" className={iconButton} onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Bajar bloque" title="Bajar">
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" className={iconButton} onClick={onDuplicate} aria-label="Duplicar bloque" title="Duplicar">
            <Copy className="h-4 w-4" />
          </button>
          <button type="button" className={`${iconButton} hover:bg-red-50 hover:text-red-600`} onClick={onRemove} aria-label="Eliminar bloque" title="Eliminar">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <BlockFields block={block} folder={folder} products={products} testimonials={testimonials} onChange={onChange} />
    </div>
  );
}

function BlockFields({
  block,
  folder,
  products,
  testimonials,
  onChange,
}: {
  block: NewsletterBlock;
  folder: string;
  products: NewsletterProductSummary[];
  testimonials: NewsletterTestimonialOption[];
  onChange: (block: NewsletterBlock) => void;
}) {
  switch (block.type) {
    case "heading":
      return <Input value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} maxLength={160} placeholder="Ej: 3 ideas para la vianda de esta semana" />;

    case "paragraph":
      return <NewsletterFormattedTextarea value={block.text} onChange={(text) => onChange({ ...block, text })} rows={6} maxLength={5000} placeholder="Escribí el texto..." />;

    case "image":
      return (
        <div className="space-y-4">
          <NewsletterImageField url={block.url} alt={block.alt} folder={folder} onChange={(value) => onChange({ ...block, ...value })} />
          <label className="block">
            <span className={fieldLabel}>Epígrafe (opcional)</span>
            <Input value={block.caption ?? ""} onChange={(event) => onChange({ ...block, caption: event.target.value })} maxLength={300} />
          </label>
        </div>
      );

    case "imageText":
      return (
        <div className="space-y-4">
          <NewsletterImageField url={block.url} alt={block.alt} folder={folder} onChange={(value) => onChange({ ...block, ...value })} />
          <label className="block">
            <span className={fieldLabel}>Posición de la imagen</span>
            <Select value={block.imagePosition} onChange={(event) => onChange({ ...block, imagePosition: event.target.value as "left" | "right" })}>
              <option value="left">Imagen a la izquierda</option>
              <option value="right">Imagen a la derecha</option>
            </Select>
          </label>
          <label className="block">
            <span className={fieldLabel}>Título (opcional)</span>
            <Input value={block.title ?? ""} onChange={(event) => onChange({ ...block, title: event.target.value })} maxLength={160} />
          </label>
          <div>
            <span className={fieldLabel}>Texto</span>
            <NewsletterFormattedTextarea value={block.text} onChange={(text) => onChange({ ...block, text })} rows={4} maxLength={3000} />
          </div>
        </div>
      );

    case "gallery":
      return (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {block.images.map((image, imageIndex) => (
              <div key={imageIndex} className="space-y-2 rounded-2xl bg-brand-ink/[0.03] p-3">
                <NewsletterImageField
                  compact
                  label={`Imagen ${imageIndex + 1}`}
                  url={image.url}
                  alt={image.alt}
                  folder={folder}
                  onChange={(value) => onChange({ ...block, images: block.images.map((item, itemIndex) => (itemIndex === imageIndex ? value : item)) })}
                />
                {block.images.length > 2 ? (
                  <button type="button" className="text-xs font-bold text-red-600 hover:underline" onClick={() => onChange({ ...block, images: block.images.filter((_, itemIndex) => itemIndex !== imageIndex) })}>
                    Quitar esta imagen
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {block.images.length < 3 ? (
            <button type="button" className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-pink hover:underline" onClick={() => onChange({ ...block, images: [...block.images, { url: "", alt: "" }] })}>
              <Plus className="h-4 w-4" /> Agregar tercera imagen
            </button>
          ) : null}
          <label className="block">
            <span className={fieldLabel}>Epígrafe (opcional)</span>
            <Input value={block.caption ?? ""} onChange={(event) => onChange({ ...block, caption: event.target.value })} maxLength={300} />
          </label>
        </div>
      );

    case "quote":
      return (
        <div className="space-y-4">
          <label className="block">
            <span className={fieldLabel}>Cita</span>
            <NewsletterFormattedTextareaPlain value={block.text} onChange={(text) => onChange({ ...block, text })} />
          </label>
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_160px]">
            <label className="block">
              <span className={fieldLabel}>Quién lo dice (opcional)</span>
              <Input value={block.author ?? ""} onChange={(event) => onChange({ ...block, author: event.target.value })} maxLength={120} placeholder="Ej: Dra. Florencia Raele" />
            </label>
            <label className="block">
              <span className={fieldLabel}>Cargo o credencial (opcional)</span>
              <Input value={block.role ?? ""} onChange={(event) => onChange({ ...block, role: event.target.value })} maxLength={240} placeholder="Ej: Médica nutricionista · Autora de..." />
            </label>
            <ToneSelect value={block.tone} onChange={(tone) => onChange({ ...block, tone })} />
          </div>
        </div>
      );

    case "button":
      return (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
            <label className="block">
              <span className={fieldLabel}>Texto del botón</span>
              <Input value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} maxLength={80} placeholder="Ver las barritas" />
            </label>
            <label className="block">
              <span className={fieldLabel}>Link</span>
              <Input value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} placeholder="/productos o https://..." />
              <span className="mt-1 block text-xs text-brand-ink/45">Los links al sitio suman UTM de newsletter automáticamente en el mail.</span>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <label className="block">
              <span className={fieldLabel}>Nota debajo del botón (opcional)</span>
              <Input value={block.note ?? ""} onChange={(event) => onChange({ ...block, note: event.target.value })} maxLength={160} placeholder="Ej: Caja Mix · 3 sabores · 12 barritas" />
            </label>
            <ToneSelect value={block.tone} onChange={(tone) => onChange({ ...block, tone })} />
          </div>
        </div>
      );

    case "product":
      return (
        <div className="space-y-4">
          <label className="block">
            <span className={fieldLabel}>Producto</span>
            <Select value={block.productId} onChange={(event) => onChange({ ...block, productId: event.target.value })}>
              <option value="">Elegí un producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} — {formatArs(product.priceArs)}
                  {product.available ? "" : " (no disponible)"}
                </option>
              ))}
            </Select>
            <span className="mt-1 block text-xs text-brand-ink/45">El precio siempre sale del catálogo. En el mail queda el precio del momento del envío.</span>
          </label>
          <label className="block">
            <span className={fieldLabel}>Comentario (opcional)</span>
            <Input value={block.note ?? ""} onChange={(event) => onChange({ ...block, note: event.target.value })} maxLength={300} placeholder="Ej: La favorita para el recreo" />
          </label>
        </div>
      );

    case "tip":
      return (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <label className="block">
              <span className={fieldLabel}>Título (opcional)</span>
              <Input value={block.title ?? ""} onChange={(event) => onChange({ ...block, title: event.target.value })} maxLength={120} />
            </label>
            <label className="block">
              <span className={fieldLabel}>Color</span>
              <Select value={block.tone} onChange={(event) => onChange({ ...block, tone: event.target.value as typeof block.tone })}>
                {NEWSLETTER_TIP_TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {NEWSLETTER_TIP_TONE_LABELS[tone]}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <NewsletterFormattedTextarea value={block.text} onChange={(text) => onChange({ ...block, text })} rows={4} maxLength={1500} />
        </div>
      );

    case "stats":
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {block.items.map((item, itemIndex) => (
              <div key={itemIndex} className="space-y-2 rounded-2xl bg-brand-ink/[0.03] p-3">
                <Input value={item.value} onChange={(event) => onChange({ ...block, items: block.items.map((current, i) => (i === itemIndex ? { ...current, value: event.target.value } : current)) })} maxLength={16} placeholder="35%" className="text-lg font-extrabold" />
                <Input value={item.label} onChange={(event) => onChange({ ...block, items: block.items.map((current, i) => (i === itemIndex ? { ...current, label: event.target.value } : current)) })} maxLength={180} placeholder="Qué significa el dato" />
                {block.items.length > 1 ? (
                  <button type="button" className="text-xs font-bold text-red-600 hover:underline" onClick={() => onChange({ ...block, items: block.items.filter((_, i) => i !== itemIndex) })}>
                    Quitar
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            {block.items.length < 3 ? (
              <button type="button" className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-pink hover:underline" onClick={() => onChange({ ...block, items: [...block.items, { value: "", label: "" }] })}>
                <Plus className="h-4 w-4" /> Agregar dato
              </button>
            ) : <span />}
            <div className="w-40">
              <ToneSelect value={block.tone} onChange={(tone) => onChange({ ...block, tone })} />
            </div>
          </div>
        </div>
      );

    case "steps":
      return (
        <div className="space-y-3">
          {block.items.map((item, itemIndex) => (
            <div key={itemIndex} className="space-y-2 rounded-2xl bg-brand-ink/[0.03] p-3">
              <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
                <Select value={item.marker} onChange={(event) => onChange({ ...block, items: block.items.map((current, i) => (i === itemIndex ? { ...current, marker: event.target.value as typeof item.marker } : current)) })} aria-label="Marcador">
                  {NEWSLETTER_STEP_MARKERS.map((marker) => (
                    <option key={marker} value={marker}>
                      {NEWSLETTER_STEP_MARKER_LABELS[marker]}
                    </option>
                  ))}
                </Select>
                <Input value={item.title} onChange={(event) => onChange({ ...block, items: block.items.map((current, i) => (i === itemIndex ? { ...current, title: event.target.value } : current)) })} maxLength={200} placeholder="Título del paso" className="font-bold" />
              </div>
              <NewsletterFormattedTextarea value={item.text} onChange={(text) => onChange({ ...block, items: block.items.map((current, i) => (i === itemIndex ? { ...current, text } : current)) })} rows={2} maxLength={1200} placeholder="Descripción (opcional)" />
              <div className="flex gap-3 text-xs font-bold">
                <button type="button" disabled={itemIndex === 0} className="text-brand-ink/55 hover:underline disabled:opacity-30" onClick={() => { const items = [...block.items]; [items[itemIndex - 1], items[itemIndex]] = [items[itemIndex], items[itemIndex - 1]]; onChange({ ...block, items }); }}>
                  Subir
                </button>
                <button type="button" disabled={itemIndex === block.items.length - 1} className="text-brand-ink/55 hover:underline disabled:opacity-30" onClick={() => { const items = [...block.items]; [items[itemIndex + 1], items[itemIndex]] = [items[itemIndex], items[itemIndex + 1]]; onChange({ ...block, items }); }}>
                  Bajar
                </button>
                {block.items.length > 1 ? (
                  <button type="button" className="text-red-600 hover:underline" onClick={() => onChange({ ...block, items: block.items.filter((_, i) => i !== itemIndex) })}>
                    Quitar
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-end justify-between gap-4">
            {block.items.length < 10 ? (
              <button type="button" className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-pink hover:underline" onClick={() => onChange({ ...block, items: [...block.items, { title: "", text: "", marker: block.items.at(-1)?.marker ?? "number" }] })}>
                <Plus className="h-4 w-4" /> Agregar paso
              </button>
            ) : <span />}
            <div className="w-40">
              <ToneSelect value={block.tone} onChange={(tone) => onChange({ ...block, tone })} />
            </div>
          </div>
        </div>
      );

    case "testimonial":
      return (
        <div className="space-y-4">
          {testimonials.length > 0 ? (
            <label className="block">
              <span className={fieldLabel}>Usar un testimonio cargado (opcional)</span>
              <Select
                value=""
                onChange={(event) => {
                  const picked = testimonials.find((item) => item.id === event.target.value);
                  if (picked) onChange({ ...block, quote: picked.quote, author: picked.name, detail: picked.roleLabel ?? "" });
                }}
              >
                <option value="">Elegí uno para completar los campos…</option>
                {testimonials.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}{item.roleLabel ? ` · ${item.roleLabel}` : ""} — “{item.quote.slice(0, 50)}{item.quote.length > 50 ? "…" : ""}”
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
          <label className="block">
            <span className={fieldLabel}>Testimonio</span>
            <NewsletterFormattedTextareaPlain value={block.quote} onChange={(quote) => onChange({ ...block, quote })} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={fieldLabel}>Nombre</span>
              <Input value={block.author} onChange={(event) => onChange({ ...block, author: event.target.value })} maxLength={120} placeholder="Flor" />
            </label>
            <label className="block">
              <span className={fieldLabel}>Detalle (opcional)</span>
              <Input value={block.detail ?? ""} onChange={(event) => onChange({ ...block, detail: event.target.value })} maxLength={160} placeholder="Mamá de Emma, 3 años" />
            </label>
          </div>
          <NewsletterImageField
            compact
            label="Foto (opcional)"
            url={block.imageUrl ?? ""}
            alt={block.imageAlt ?? ""}
            folder={folder}
            onChange={(value) => onChange({ ...block, imageUrl: value.url, imageAlt: value.alt })}
          />
        </div>
      );

    case "sources":
      return (
        <div className="space-y-4">
          <label className="block sm:w-64">
            <span className={fieldLabel}>Título</span>
            <Input value={block.label} onChange={(event) => onChange({ ...block, label: event.target.value })} maxLength={60} placeholder="Fuentes" />
          </label>
          <NewsletterFormattedTextarea value={block.text} onChange={(text) => onChange({ ...block, text })} rows={3} maxLength={1500} placeholder="UNICEF Argentina (2024) — ..." />
        </div>
      );

    case "divider":
      return <p className="text-sm text-brand-ink/50">Separador visual entre secciones. No necesita configuración.</p>;
  }
}

export function duplicateBlock(block: NewsletterBlock): NewsletterBlock {
  return { ...structuredClone(block), id: createBlockId() };
}

function NewsletterFormattedTextareaPlain({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={3}
      maxLength={800}
      className="min-h-24 w-full rounded-3xl border border-brand-ink/10 bg-white px-4 py-3 text-base text-brand-ink outline-none transition placeholder:text-brand-ink/40 focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20 md:text-sm"
    />
  );
}
