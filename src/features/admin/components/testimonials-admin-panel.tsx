"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TestimonialListItem = {
  id: string;
  name: string;
  roleLabel: string | null;
  quote: string;
  active: boolean;
  sortOrder: number;
};

type TestimonialsAdminPanelProps = {
  testimonials: TestimonialListItem[];
};

type TestimonialFormState = {
  name: string;
  roleLabel: string;
  quote: string;
  active: boolean;
  sortOrder: string;
};

const emptyForm: TestimonialFormState = {
  name: "",
  roleLabel: "",
  quote: "",
  active: true,
  sortOrder: "0",
};

export function TestimonialsAdminPanel({ testimonials }: TestimonialsAdminPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TestimonialFormState>(emptyForm);

  const editingTestimonial = useMemo(
    () => testimonials.find((testimonial) => testimonial.id === editingId) ?? null,
    [testimonials, editingId],
  );

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  function loadTestimonial(testimonial: TestimonialListItem) {
    setEditingId(testimonial.id);
    setForm({
      name: testimonial.name,
      roleLabel: testimonial.roleLabel ?? "",
      quote: testimonial.quote,
      active: testimonial.active,
      sortOrder: String(testimonial.sortOrder),
    });
    setError(null);
  }

  async function submitForm() {
    const url = editingId ? `/api/admin/testimonials/${editingId}` : "/api/admin/testimonials";
    const method = editingId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        sortOrder: Number(form.sortOrder),
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "No pudimos guardar el testimonio.");
      return;
    }

    resetForm();
    router.refresh();
  }

  async function removeTestimonial(testimonialId: string) {
    const response = await fetch(`/api/admin/testimonials/${testimonialId}`, {
      method: "DELETE",
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "No pudimos eliminar el testimonio.");
      return;
    }

    if (editingId === testimonialId) {
      resetForm();
    }

    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Testimonios</p>
        <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Comentarios de clientes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/70 md:text-base">
          Administra los comentarios que aparecen en la landing nueva.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="space-y-5 p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">
                {editingTestimonial ? "Editar testimonio" : "Nuevo testimonio"}
              </p>
              <p className="mt-2 text-sm text-brand-ink/70">
                Define el texto, autor y orden de aparicion.
              </p>
            </div>
            {editingTestimonial ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4">
            <Field label="Nombre">
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="Metadata visible">
              <Input
                value={form.roleLabel}
                placeholder="Mama de Mateo (7) - Buenos Aires"
                onChange={(event) => setForm((current) => ({ ...current, roleLabel: event.target.value }))}
              />
            </Field>
            <Field label="Orden">
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
              />
            </Field>
            <Field label="Comentario">
              <Textarea
                value={form.quote}
                onChange={(event) => setForm((current) => ({ ...current, quote: event.target.value }))}
              />
            </Field>
            <Checkbox
              label="Testimonio activo"
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
            {isPending ? "Guardando..." : editingTestimonial ? "Guardar cambios" : "Crear testimonio"}
          </Button>
        </Card>

        <Card className="space-y-4 p-5 md:p-6">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Listado actual</p>
            <p className="mt-2 text-sm text-brand-ink/70">{testimonials.length} testimonios cargados.</p>
          </div>

          <div className="space-y-3">
            {testimonials.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-brand-ink/15 p-6 text-sm text-brand-ink/55">
                Todavia no hay testimonios cargados.
              </div>
            ) : (
              testimonials.map((testimonial) => {
                const isEditing = testimonial.id === editingId;

                return (
                  <div
                    key={testimonial.id}
                    className={`rounded-[1.5rem] border p-4 transition ${
                      isEditing ? "border-brand-pink bg-brand-pink/5" : "border-brand-ink/10 bg-background"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-brand-ink">{testimonial.name}</p>
                          <span className="rounded-full bg-brand-peach px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-pink">
                            Orden {testimonial.sortOrder}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${
                              testimonial.active ? "bg-green-100 text-green-700" : "bg-brand-ink/10 text-brand-ink/55"
                            }`}
                          >
                            {testimonial.active ? "Activo" : "Pausado"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-brand-ink/70">{testimonial.roleLabel || "Sin metadata visible."}</p>
                        <p className="mt-3 text-sm italic text-brand-ink">&ldquo;{testimonial.quote}&rdquo;</p>
                      </div>

                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => loadTestimonial(testimonial)}>
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
                              await removeTestimonial(testimonial.id);
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
