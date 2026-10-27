"use client";

import { ChevronDown, ChevronUp, ExternalLink, ImagePlus, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WHOLESALE_ADMIN_SECTIONS, type WholesaleAdminSectionId } from "@/features/wholesale/admin-sections";
import { DEFAULT_WHOLESALE_CONTENT, type WholesaleContent, type WholesaleSectionIntro } from "@/features/wholesale/content";
import { cn } from "@/lib/utils/cn";

type WholesaleAdminPanelProps = {
  content: WholesaleContent;
  storeWhatsapp: string | null;
  sectionId: WholesaleAdminSectionId;
  hasAccessPassword: boolean;
};

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSize = 8 * 1024 * 1024;

function parseLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="grid content-start gap-1.5 text-sm font-bold text-brand-ink">
      {label}
      {children}
      {hint ? <span className="text-xs font-normal text-brand-ink/50">{hint}</span> : null}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  multiline,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  hint?: ReactNode;
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      {multiline ? (
        <Textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="min-h-24" />
      ) : (
        <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
    </Field>
  );
}

function NumberField({ label, value, onChange, hint }: { label: string; value: number; onChange: (value: number) => void; hint?: ReactNode }) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(Number.parseInt(event.target.value, 10) || 0)}
      />
    </Field>
  );
}

function LinesField({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (value: string[]) => void; hint?: ReactNode }) {
  // Se edita como texto libre y se convierte a lista al salir del campo, para no comerse los renglones vacíos mientras se escribe.
  const [draft, setDraft] = useState(value.join("\n"));

  return (
    <Field label={label} hint={hint ?? "Uno por renglón."}>
      <Textarea
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(parseLines(event.target.value));
        }}
        onBlur={() => setDraft(value.join("\n"))}
        className="min-h-32"
      />
    </Field>
  );
}

function IntroFields({ value, onChange, hideDescription }: { value: WholesaleSectionIntro; onChange: (value: WholesaleSectionIntro) => void; hideDescription?: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TextField label="Encabezado (texto chico rosa)" value={value.eyebrow} onChange={(eyebrow) => onChange({ ...value, eyebrow })} />
      <TextField label="Título" value={value.title} onChange={(title) => onChange({ ...value, title })} />
      {hideDescription ? null : (
        <div className="md:col-span-2">
          <TextField label="Descripción" value={value.description} onChange={(description) => onChange({ ...value, description })} multiline />
        </div>
      )}
    </div>
  );
}

function ListEditor<T>({
  items,
  onChange,
  createItem,
  addLabel,
  itemTitle,
  renderItem,
  max,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  addLabel: string;
  itemTitle: (item: T, index: number) => string;
  renderItem: (item: T, update: (item: T) => void) => ReactNode;
  max: number;
}) {
  function move(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="rounded-3xl border border-brand-ink/10 bg-[#fff6f7]/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-extrabold text-brand-ink">
              <span className="mr-2 text-brand-ink/40">{index + 1}.</span>
              {itemTitle(item, index) || "Sin título"}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" aria-label="Subir" onClick={() => move(index, -1)} disabled={index === 0} className="rounded-full p-1.5 text-brand-ink/60 hover:bg-white disabled:opacity-30">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Bajar" onClick={() => move(index, 1)} disabled={index === items.length - 1} className="rounded-full p-1.5 text-brand-ink/60 hover:bg-white disabled:opacity-30">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Eliminar"
                onClick={() => {
                  if (window.confirm("¿Eliminar este elemento?")) onChange(items.filter((_, itemIndex) => itemIndex !== index));
                }}
                className="rounded-full p-1.5 text-brand-ink/60 hover:bg-white hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {renderItem(item, (updated) => onChange(items.map((current, itemIndex) => (itemIndex === index ? updated : current))))}
        </div>
      ))}
      {items.length < max ? (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, createItem()])}>
          <Plus className="mr-1.5 h-4 w-4" />
          {addLabel}
        </Button>
      ) : (
        <p className="text-xs text-brand-ink/50">Llegaste al máximo de {max}.</p>
      )}
    </div>
  );
}

function ImageField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!allowedImageTypes.includes(file.type)) {
      setError("Usá una imagen JPG, PNG o WEBP.");
      return;
    }
    if (file.size > maxImageSize) {
      setError("La imagen supera el máximo de 8 MB.");
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/upload/wholesale-image", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No pudimos subir la imagen.");
        return;
      }
      onChange(payload.data.publicUrl);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-brand-ink/10">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-brand-ink/40">Sin imagen</span>
        )}
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:ring-brand-pink/40"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {value ? "Cambiar imagen" : "Subir imagen"}
        </label>
        <input
          id={inputId}
          type="file"
          accept={allowedImageTypes.join(",")}
          className="sr-only"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
        <p className="text-xs text-brand-ink/50">JPG, PNG o WEBP · hasta 8 MB · se muestra en formato 4:3.</p>
        {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}

function AdminSection({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      {title ? (
        <div className="border-b border-brand-ink/10 p-5 md:p-6">
          <p className="font-display text-2xl leading-none text-brand-ink">{title}</p>
          {description ? <p className="mt-1.5 text-sm text-brand-ink/60">{description}</p> : null}
        </div>
      ) : null}
      <div className="space-y-5 p-5 md:p-6">{children}</div>
    </Card>
  );
}

function SubTitle({ children }: { children: ReactNode }) {
  return <p className="pt-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-ink/50">{children}</p>;
}

export function WholesaleAdminPanel({ content: initialContent, storeWhatsapp, sectionId, hasAccessPassword: initialHasPassword }: WholesaleAdminPanelProps) {
  const router = useRouter();
  const section = WHOLESALE_ADMIN_SECTIONS.find((item) => item.id === sectionId) ?? WHOLESALE_ADMIN_SECTIONS[0];
  const is = (id: WholesaleAdminSectionId) => section.id === id;
  const [content, setContent] = useState<WholesaleContent>(initialContent);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialContent));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Los campos de "uno por renglón" guardan su propio borrador; se remontan al restaurar.
  const [formKey, setFormKey] = useState(0);
  const [hasAccessPassword, setHasAccessPassword] = useState(initialHasPassword);
  const [newAccessPassword, setNewAccessPassword] = useState("");
  const [removeAccessPassword, setRemoveAccessPassword] = useState(false);
  const dirty = JSON.stringify(content) !== savedSnapshot || newAccessPassword.trim() !== "" || removeAccessPassword;

  function patch<K extends keyof WholesaleContent>(key: K, value: WholesaleContent[K]) {
    setContent((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/wholesale-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...content, newAccessPassword: newAccessPassword.trim(), removeAccessPassword }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No pudimos guardar los cambios.");
        return;
      }
      setSavedSnapshot(JSON.stringify(content));
      if (newAccessPassword.trim()) setHasAccessPassword(true);
      else if (removeAccessPassword) setHasAccessPassword(false);
      setNewAccessPassword("");
      setRemoveAccessPassword(false);
      setMessage("Cambios guardados. Ya se ven en /mayoristas.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function restoreDefaults() {
    if (!window.confirm(`¿Volver al contenido original de “${section.label}”? Los cambios no se guardan hasta que toques “Guardar cambios”.`)) return;
    setContent((current) => {
      const next = { ...current };
      for (const key of section.keys) {
        Object.assign(next, { [key]: DEFAULT_WHOLESALE_CONTENT[key] });
      }
      return next;
    });
    setFormKey((key) => key + 1);
    setMessage(null);
  }

  const { hero, products, profiles, reasons, conditions, steps, testimonials, contact, faq } = content;

  return (
    <div key={formKey} className="space-y-6 pb-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Mayoristas</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-5xl">{section.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/70 md:text-base">
            {section.description} Si una lista queda vacía, esa parte no se muestra en la página.
          </p>
        </div>
        <a
          href="/mayoristas"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:ring-brand-pink/40"
        >
          Ver página
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {is("general") ? (
        <AdminSection title="General" description="Publicación, SEO, WhatsApp y barra superior.">
        <Checkbox
          label="Página publicada (si la desactivás, /mayoristas devuelve “página no encontrada”)."
          checked={content.enabled}
          onChange={(event) => patch("enabled", event.target.checked)}
        />
        <div className="space-y-3 rounded-3xl bg-[#fff6f7] p-4">
          <p className="text-sm font-bold text-brand-ink">
            Contraseña para ver la página:{" "}
            <span className={cn(hasAccessPassword && !removeAccessPassword ? "text-emerald-700" : "text-brand-pink")}>
              {removeAccessPassword ? "se quita al guardar" : hasAccessPassword ? "activa" : "sin contraseña (página abierta a todos)"}
            </span>
          </p>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <Field label={hasAccessPassword ? "Cambiar contraseña" : "Poner contraseña"} hint="Mínimo 6 caracteres. Al cambiarla, todos tienen que volver a ingresarla.">
              <Input
                value={newAccessPassword}
                autoComplete="off"
                placeholder={hasAccessPassword ? "Nueva contraseña" : "Contraseña"}
                onChange={(event) => {
                  setNewAccessPassword(event.target.value);
                  setRemoveAccessPassword(false);
                  setMessage(null);
                }}
              />
            </Field>
            {hasAccessPassword ? (
              <Checkbox
                label="Quitar contraseña"
                checked={removeAccessPassword}
                onChange={(event) => {
                  setRemoveAccessPassword(event.target.checked);
                  if (event.target.checked) setNewAccessPassword("");
                  setMessage(null);
                }}
                className="pb-8"
              />
            ) : null}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Título para Google (SEO)" value={content.seoTitle} onChange={(value) => patch("seoTitle", value)} hint="Se completa con “| IQ Kids”." />
          <TextField
            label="WhatsApp para consultas y pedidos"
            value={content.whatsappNumber}
            onChange={(value) => patch("whatsappNumber", value)}
            placeholder={storeWhatsapp ?? "5491112345678"}
            hint={`Vacío = usa el de Configuración${storeWhatsapp ? ` (${storeWhatsapp})` : ""}.`}
          />
          <div className="md:col-span-2">
            <TextField label="Descripción para Google (SEO)" value={content.seoDescription} onChange={(value) => patch("seoDescription", value)} multiline />
          </div>
          <div className="md:col-span-2">
            <TextField label="Barra superior" value={content.topbar} onChange={(value) => patch("topbar", value)} hint="Franja oscura arriba de todo. Vacía = no se muestra." />
          </div>
        </div>
      </AdminSection>
      ) : null}

      {is("general") ? (
        <AdminSection title="Portada" description="Título, bajada, etiquetas y botones.">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Encabezado (texto chico rosa)" value={hero.eyebrow} onChange={(eyebrow) => patch("hero", { ...hero, eyebrow })} />
          <TextField label="Título" value={hero.title} onChange={(title) => patch("hero", { ...hero, title })} />
          <TextField label="Título destacado (rosa, más chico)" value={hero.titleAccent} onChange={(titleAccent) => patch("hero", { ...hero, titleAccent })} />
          <div />
          <div className="md:col-span-2">
            <TextField label="Descripción" value={hero.description} onChange={(description) => patch("hero", { ...hero, description })} multiline />
          </div>
          <TextField label="Botón principal (va al formulario)" value={hero.primaryCta} onChange={(primaryCta) => patch("hero", { ...hero, primaryCta })} />
          <TextField label="Botón secundario (va al pedido rápido; se oculta mientras esté en “Próximamente”)" value={hero.secondaryCta} onChange={(secondaryCta) => patch("hero", { ...hero, secondaryCta })} />
        </div>
        <SubTitle>Etiquetas</SubTitle>
        <ListEditor
          items={hero.chips}
          onChange={(chips) => patch("hero", { ...hero, chips })}
          createItem={() => ({ label: "", accent: false })}
          addLabel="Agregar etiqueta"
          itemTitle={(chip) => chip.label}
          max={8}
          renderItem={(chip, update) => (
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <TextField label="Texto" value={chip.label} onChange={(label) => update({ ...chip, label })} />
              <Checkbox label="Destacada (rosa)" checked={chip.accent} onChange={(event) => update({ ...chip, accent: event.target.checked })} className="pb-3" />
            </div>
          )}
        />
      </AdminSection>
      ) : null}

      {is("general") ? (
        <AdminSection title="Números destacados" description="La franja rosa debajo de la portada.">
        <ListEditor
          items={content.stats}
          onChange={(stats) => patch("stats", stats)}
          createItem={() => ({ value: "", label: "" })}
          addLabel="Agregar número"
          itemTitle={(stat) => stat.value}
          max={6}
          renderItem={(stat, update) => (
            <div className="grid gap-3 md:grid-cols-[180px_1fr]">
              <TextField label="Número" value={stat.value} onChange={(value) => update({ ...stat, value })} />
              <TextField label="Texto" value={stat.label} onChange={(label) => update({ ...stat, label })} multiline hint="Podés usar saltos de línea." />
            </div>
          )}
        />
      </AdminSection>
      ) : null}

      {is("productos") ? (
        <AdminSection>
        <IntroFields value={products} onChange={(intro) => patch("products", { ...products, ...intro })} />
        <SubTitle>Productos</SubTitle>
        <ListEditor
          items={products.items}
          onChange={(items) => patch("products", { ...products, items })}
          createItem={() => ({ name: "", description: "", imageUrl: "", imageAlt: "" })}
          addLabel="Agregar producto"
          itemTitle={(product) => product.name}
          max={12}
          renderItem={(product, update) => (
            <div className="grid gap-4">
              <ImageField value={product.imageUrl} onChange={(imageUrl) => update({ ...product, imageUrl })} />
              <div className="grid gap-3 md:grid-cols-2">
                <TextField label="Nombre" value={product.name} onChange={(name) => update({ ...product, name })} />
                <TextField label="Texto alternativo de la foto" value={product.imageAlt} onChange={(imageAlt) => update({ ...product, imageAlt })} hint="Para accesibilidad y Google." />
                <div className="md:col-span-2">
                  <TextField label="Descripción" value={product.description} onChange={(description) => update({ ...product, description })} />
                </div>
              </div>
            </div>
          )}
        />
      </AdminSection>
      ) : null}

      {is("contenido") ? (
        <AdminSection title="Para quién es" description="Tarjetas de tipos de negocio.">
        <IntroFields value={profiles} onChange={(intro) => patch("profiles", { ...profiles, ...intro })} />
        <SubTitle>Tarjetas</SubTitle>
        <ListEditor
          items={profiles.items}
          onChange={(items) => patch("profiles", { ...profiles, items })}
          createItem={() => ({ icon: "", title: "", description: "" })}
          addLabel="Agregar tarjeta"
          itemTitle={(item) => `${item.icon} ${item.title}`.trim()}
          max={12}
          renderItem={(item, update) => (
            <div className="grid gap-3 md:grid-cols-[110px_1fr]">
              <TextField label="Ícono (emoji)" value={item.icon} onChange={(icon) => update({ ...item, icon })} />
              <TextField label="Título" value={item.title} onChange={(title) => update({ ...item, title })} />
              <div className="md:col-span-2">
                <TextField label="Descripción" value={item.description} onChange={(description) => update({ ...item, description })} multiline />
              </div>
            </div>
          )}
        />
      </AdminSection>
      ) : null}

      {is("contenido") ? (
        <AdminSection title="Por qué funciona" description="Razones por las que se vende en el punto de venta.">
        <IntroFields value={reasons} onChange={(intro) => patch("reasons", { ...reasons, ...intro })} />
        <SubTitle>Razones</SubTitle>
        <ListEditor
          items={reasons.items}
          onChange={(items) => patch("reasons", { ...reasons, items })}
          createItem={() => ({ icon: "", title: "", description: "" })}
          addLabel="Agregar razón"
          itemTitle={(item) => `${item.icon} ${item.title}`.trim()}
          max={12}
          renderItem={(item, update) => (
            <div className="grid gap-3 md:grid-cols-[110px_1fr]">
              <TextField label="Ícono (emoji)" value={item.icon} onChange={(icon) => update({ ...item, icon })} />
              <TextField label="Título" value={item.title} onChange={(title) => update({ ...item, title })} />
              <div className="md:col-span-2">
                <TextField label="Descripción" value={item.description} onChange={(description) => update({ ...item, description })} multiline />
              </div>
            </div>
          )}
        />
      </AdminSection>
      ) : null}

      {is("condiciones") ? (
        <AdminSection>
        <IntroFields value={conditions} onChange={(intro) => patch("conditions", { ...conditions, ...intro })} />
        <SubTitle>Planes</SubTitle>
        <ListEditor
          items={conditions.plans}
          onChange={(plans) => patch("conditions", { ...conditions, plans })}
          createItem={() => ({ icon: "", title: "", subtitle: "", price: 0, priceUnit: "/ display (x12 barritas)", highlighted: false, rows: [], cta: "Quiero empezar →" })}
          addLabel="Agregar plan"
          itemTitle={(plan) => plan.title}
          max={3}
          renderItem={(plan, update) => (
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-[110px_1fr_1fr]">
                <TextField label="Ícono" value={plan.icon} onChange={(icon) => update({ ...plan, icon })} />
                <TextField label="Nombre" value={plan.title} onChange={(title) => update({ ...plan, title })} />
                <TextField label="Bajada" value={plan.subtitle} onChange={(subtitle) => update({ ...plan, subtitle })} />
                <div />
                <NumberField label="Precio (ARS, IVA incluido)" value={plan.price} onChange={(price) => update({ ...plan, price })} />
                <TextField label="Unidad del precio" value={plan.priceUnit} onChange={(priceUnit) => update({ ...plan, priceUnit })} />
                <div />
                <TextField label="Texto del botón" value={plan.cta} onChange={(cta) => update({ ...plan, cta })} />
                <Checkbox label="Destacar en celeste" checked={plan.highlighted} onChange={(event) => update({ ...plan, highlighted: event.target.checked })} className="self-end pb-3" />
              </div>
              <SubTitle>Filas del plan</SubTitle>
              <ListEditor
                items={plan.rows}
                onChange={(rows) => update({ ...plan, rows })}
                createItem={() => ({ label: "", value: "", note: "" })}
                addLabel="Agregar fila"
                itemTitle={(row) => row.label}
                max={10}
                renderItem={(row, updateRow) => (
                  <div className="grid gap-3 md:grid-cols-3">
                    <TextField label="Dato" value={row.label} onChange={(label) => updateRow({ ...row, label })} />
                    <TextField label="Valor" value={row.value} onChange={(value) => updateRow({ ...row, value })} />
                    <TextField label="Aclaración (opcional)" value={row.note} onChange={(note) => updateRow({ ...row, note })} />
                  </div>
                )}
              />
            </div>
          )}
        />
      </AdminSection>
      ) : null}

      {is("contenido") ? (
        <AdminSection title="Pasos" description="“Empezá en 3 pasos”.">
        <IntroFields value={steps} onChange={(intro) => patch("steps", { ...steps, ...intro })} />
        <SubTitle>Pasos</SubTitle>
        <ListEditor
          items={steps.items}
          onChange={(items) => patch("steps", { ...steps, items })}
          createItem={() => ({ title: "", description: "" })}
          addLabel="Agregar paso"
          itemTitle={(item) => item.title}
          max={6}
          renderItem={(item, update) => (
            <div className="grid gap-3">
              <TextField label="Título" value={item.title} onChange={(title) => update({ ...item, title })} />
              <TextField label="Descripción" value={item.description} onChange={(description) => update({ ...item, description })} multiline />
            </div>
          )}
        />
      </AdminSection>
      ) : null}

      {is("testimonios") ? (
        <AdminSection>
        <IntroFields value={testimonials} onChange={(intro) => patch("testimonials", { ...testimonials, ...intro })} />
        <SubTitle>Testimonios</SubTitle>
        <ListEditor
          items={testimonials.items}
          onChange={(items) => patch("testimonials", { ...testimonials, items })}
          createItem={() => ({ tag: "Punto de venta", quote: "", name: "", meta: "" })}
          addLabel="Agregar testimonio"
          itemTitle={(item) => item.name}
          max={9}
          renderItem={(item, update) => (
            <div className="grid gap-3 md:grid-cols-3">
              <TextField label="Etiqueta" value={item.tag} onChange={(tag) => update({ ...item, tag })} placeholder="Punto de venta" />
              <TextField label="Nombre" value={item.name} onChange={(name) => update({ ...item, name })} />
              <TextField label="Detalle" value={item.meta} onChange={(meta) => update({ ...item, meta })} placeholder="Dietética · Zona" />
              <div className="md:col-span-3">
                <TextField label="Frase (sin comillas)" value={item.quote} onChange={(quote) => update({ ...item, quote })} multiline />
              </div>
            </div>
          )}
        />
      </AdminSection>
      ) : null}

      {is("pedido") ? (
        <AdminSection>
        <IntroFields value={contact} onChange={(intro) => patch("contact", { ...contact, ...intro })} />
        <SubTitle>Aviso de consultas nuevas</SubTitle>
        <LinesField
          label="Emails que reciben el aviso"
          value={contact.leadNotificationEmails}
          onChange={(leadNotificationEmails) => patch("contact", { ...contact, leadNotificationEmails })}
          hint="Uno por renglón (hasta 5). Cada consulta nueva llega con todos los datos del formulario. Vacío = sin aviso."
        />
        <SubTitle>Pestaña “Soy nuevo”</SubTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Título" value={contact.leadTitle} onChange={(leadTitle) => patch("contact", { ...contact, leadTitle })} />
          <TextField label="Descripción" value={contact.leadDescription} onChange={(leadDescription) => patch("contact", { ...contact, leadDescription })} />
          <LinesField label="Tipos de negocio" value={contact.businessTypes} onChange={(businessTypes) => patch("contact", { ...contact, businessTypes })} />
          <LinesField
            label="Cantidad estimada por mes"
            value={contact.monthlyVolumes}
            onChange={(monthlyVolumes) => patch("contact", { ...contact, monthlyVolumes })}
            hint="Uno por renglón. Vacío = no se pregunta."
          />
        </div>
        <SubTitle>Pestaña “Ya soy cliente”</SubTitle>
        <Checkbox
          label="Pedido rápido habilitado. Si está apagado, la pestaña muestra “Próximamente” con un botón a WhatsApp y se ocultan los accesos al pedido."
          checked={contact.orderEnabled}
          onChange={(event) => patch("contact", { ...contact, orderEnabled: event.target.checked })}
        />
        {contact.orderEnabled ? null : (
          <TextField
            label="Texto de “Próximamente”"
            value={contact.orderComingSoonText}
            onChange={(orderComingSoonText) => patch("contact", { ...contact, orderComingSoonText })}
            multiline
          />
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Título" value={contact.orderTitle} onChange={(orderTitle) => patch("contact", { ...contact, orderTitle })} />
          <NumberField
            label="Pedido mínimo (displays)"
            value={contact.minDisplays}
            onChange={(minDisplays) => patch("contact", { ...contact, minDisplays })}
            hint="El botón de enviar se habilita al llegar a este mínimo."
          />
          <div className="md:col-span-2">
            <TextField label="Descripción" value={contact.orderDescription} onChange={(orderDescription) => patch("contact", { ...contact, orderDescription })} />
          </div>
        </div>
        <SubTitle>Productos del pedido rápido</SubTitle>
        <ListEditor
          items={contact.orderItems}
          onChange={(orderItems) => patch("contact", { ...contact, orderItems })}
          createItem={() => ({ name: "", price: conditions.plans[0]?.price ?? 0 })}
          addLabel="Agregar producto"
          itemTitle={(item) => item.name}
          max={12}
          renderItem={(item, update) => (
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <TextField label="Nombre" value={item.name} onChange={(name) => update({ ...item, name })} />
              <NumberField label="Precio por display (ARS)" value={item.price} onChange={(price) => update({ ...item, price })} />
            </div>
          )}
        />
      </AdminSection>
      ) : null}

      {is("preguntas") ? (
        <AdminSection>
        <IntroFields value={faq} onChange={(intro) => patch("faq", { ...faq, ...intro })} hideDescription />
        <SubTitle>Preguntas</SubTitle>
        <ListEditor
          items={faq.items}
          onChange={(items) => patch("faq", { ...faq, items })}
          createItem={() => ({ question: "", answer: "" })}
          addLabel="Agregar pregunta"
          itemTitle={(item) => item.question}
          max={30}
          renderItem={(item, update) => (
            <div className="grid gap-3">
              <TextField label="Pregunta" value={item.question} onChange={(question) => update({ ...item, question })} />
              <TextField label="Respuesta" value={item.answer} onChange={(answer) => update({ ...item, answer })} multiline />
            </div>
          )}
        />
      </AdminSection>
      ) : null}

      <Card className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 p-4 ring-1 ring-brand-ink/5">
        <div className="min-w-0 text-sm">
          {error ? (
            <p className="font-bold text-red-600">{error}</p>
          ) : message ? (
            <p className="font-bold text-emerald-700">{message}</p>
          ) : (
            <p className={cn(dirty ? "font-bold text-brand-pink" : "text-brand-ink/50")}>{dirty ? "Tenés cambios sin guardar." : "Sin cambios pendientes."}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={restoreDefaults} disabled={saving}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Restaurar original
          </Button>
          <Button type="button" onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar cambios
          </Button>
        </div>
      </Card>
    </div>
  );
}
