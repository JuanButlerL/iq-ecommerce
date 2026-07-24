"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

type ShortLinkItem = {
  id: string;
  slug: string;
  targetUrl: string;
  title: string | null;
  description: string | null;
  active: boolean;
  clickCount: number;
  lastClickedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type ShortLinksPanelProps = {
  links: ShortLinkItem[];
  siteUrl: string;
};

type FormState = {
  id: string | null;
  slug: string;
  targetUrl: string;
  title: string;
  description: string;
  active: boolean;
};

const emptyForm: FormState = {
  id: null,
  slug: "",
  targetUrl: "",
  title: "",
  description: "",
  active: true,
};

export function ShortLinksPanel({ links, siteUrl }: ShortLinksPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(links[0]?.id ?? null);
  const selected = useMemo(() => links.find((link) => link.id === selectedId) ?? null, [links, selectedId]);
  const [form, setForm] = useState<FormState>(() => toForm(selected));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publicUrl = form.slug ? `${siteUrl}/${form.slug}` : "";

  const edit = (link: ShortLinkItem) => {
    setSelectedId(link.id);
    setForm(toForm(link));
    setMessage(null);
    setError(null);
  };

  const createNew = () => {
    setSelectedId(null);
    setForm(emptyForm);
    setMessage(null);
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    const response = await fetch(form.id ? `/api/admin/short-links/${form.id}` : "/api/admin/short-links", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = (await response.json()) as { error?: string };
    setIsSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "No se pudo guardar el link.");
      return;
    }

    setMessage(form.id ? "Link actualizado." : "Link creado.");
    window.setTimeout(() => window.location.reload(), 700);
  };

  const remove = async () => {
    if (!form.id || !window.confirm("Eliminar este link corto?")) {
      return;
    }

    const response = await fetch(`/api/admin/short-links/${form.id}`, { method: "DELETE" });

    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? "No se pudo eliminar el link.");
      return;
    }

    window.location.reload();
  };

  const copyUrl = async (url: string) => {
    await navigator.clipboard?.writeText(url);
    setMessage("Link copiado.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Links</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Links cortos IQ Kids</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/65">
            Crea URLs simples para compartir mapas, promos, formularios o landings externas sin depender de links largos.
          </p>
        </div>
        <Button type="button" onClick={createNew}>
          Nuevo link
        </Button>
      </div>

      {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="p-4 md:p-5">
          <div className="mb-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-pink">Creados</p>
            <p className="mt-1 text-sm text-brand-ink/55">{links.length} links disponibles.</p>
          </div>
          <div className="space-y-3">
            {links.length ? (
              links.map((link) => {
                const url = `${siteUrl}/${link.slug}`;

                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => edit(link)}
                    className={cn(
                      "w-full rounded-3xl border p-4 text-left transition hover:border-brand-pink/45 hover:bg-brand-pinkSoft/25",
                      selectedId === link.id ? "border-brand-pink bg-brand-pinkSoft/35" : "border-brand-ink/10 bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-brand-ink">{link.title || `/${link.slug}`}</p>
                        <p className="mt-1 break-all text-xs font-bold text-brand-ink/55">{url}</p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.12em]",
                          link.active ? "bg-emerald-50 text-emerald-700" : "bg-brand-ink/5 text-brand-ink/45",
                        )}
                      >
                        {link.active ? "Activo" : "Pausado"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-bold text-brand-ink/45">
                      <span>{link.clickCount} clicks</span>
                      <span>{link.lastClickedAt ? formatArgentinaDateTime(new Date(link.lastClickedAt)) : "Sin clicks"}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="rounded-3xl bg-background px-4 py-6 text-sm text-brand-ink/55">Todavia no hay links creados.</p>
            )}
          </div>
        </Card>

        <Card className="p-5 md:p-6">
          <form className="space-y-5" onSubmit={submit}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-pink">
                  {form.id ? "Editar link" : "Nuevo link"}
                </p>
                <h2 className="mt-2 font-display text-2xl text-brand-ink md:text-3xl">
                  {publicUrl || "Elegí un nombre corto"}
                </h2>
              </div>
              <label className="flex w-full items-center justify-between gap-3 rounded-2xl border border-brand-ink/10 bg-background px-4 py-3 text-sm font-bold text-brand-ink lg:w-56">
                Activo
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                  className="h-5 w-5 accent-brand-pink"
                />
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Nombre corto">
                <div className="flex overflow-hidden rounded-2xl border border-brand-ink/10 bg-white focus-within:border-brand-pink/40 focus-within:ring-2 focus-within:ring-brand-pink/20">
                  <span className="flex items-center border-r border-brand-ink/10 bg-background px-4 text-sm font-bold text-brand-ink/45">
                    /
                  </span>
                  <input
                    value={form.slug}
                    onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                    placeholder="puntos-de-venta"
                    required
                    className="h-12 min-w-0 flex-1 px-4 text-sm text-brand-ink outline-none"
                  />
                </div>
              </Field>
              <Field label="Destino real">
                <Input
                  type="url"
                  value={form.targetUrl}
                  onChange={(event) => setForm((current) => ({ ...current, targetUrl: event.target.value }))}
                  placeholder="https://maps.google.com/..."
                  required
                />
              </Field>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Titulo interno">
                <Input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Mapa de puntos de venta"
                />
              </Field>
              <Field label="Descripcion interna">
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Para campañas, WhatsApp o historias."
                />
              </Field>
            </div>

            {publicUrl ? (
              <div className="rounded-3xl border border-brand-ink/10 bg-background p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">Link público</p>
                <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <a href={publicUrl} target="_blank" rel="noreferrer" className="break-all text-sm font-extrabold text-brand-ink underline">
                    {publicUrl}
                  </a>
                  <Button type="button" variant="secondary" onClick={() => copyUrl(publicUrl)}>
                    Copiar
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-brand-ink/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar link"}
              </Button>
              {form.id ? (
                <Button type="button" variant="ghost" onClick={remove}>
                  Eliminar
                </Button>
              ) : null}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

function toForm(link: ShortLinkItem | null): FormState {
  if (!link) {
    return emptyForm;
  }

  return {
    id: link.id,
    slug: link.slug,
    targetUrl: link.targetUrl,
    title: link.title ?? "",
    description: link.description ?? "",
    active: link.active,
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-brand-ink">{label}</span>
      {children}
    </label>
  );
}
