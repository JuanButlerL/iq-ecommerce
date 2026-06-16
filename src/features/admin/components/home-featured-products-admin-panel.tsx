"use client";

import type { ReactNode } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ProductOption = {
  id: string;
  name: string;
  slug: string;
};

type SlotItem = {
  slotOrder: number;
  productId: string;
  eyebrow: string;
  title: string;
  description: string;
  quote: string | null;
  buttonLabel: string;
};

type HomeFeaturedProductsAdminPanelProps = {
  products: ProductOption[];
  slots: SlotItem[];
};

export function HomeFeaturedProductsAdminPanel({
  products,
  slots,
}: HomeFeaturedProductsAdminPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(
    slots.map((slot) => ({
      ...slot,
      quote: slot.quote ?? "",
    })),
  );

  function updateSlot(slotOrder: number, field: keyof (typeof form)[number], value: string) {
    setForm((current) =>
      current.map((slot) => (slot.slotOrder === slotOrder ? { ...slot, [field]: value } : slot)),
    );
  }

  async function submitForm() {
    const response = await fetch("/api/admin/home-featured-products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slots: form }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "No pudimos guardar los productos del home.");
      return;
    }

    setError(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Home</p>
        <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Productos destacados</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-ink/70 md:text-base">
          Define los 4 productos que aparecen en la landing. La foto que se usa en home sale de la primera imagen del
          producto en Admin &gt; Productos.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {form.map((slot) => (
          <Card key={slot.slotOrder} className="space-y-5 p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">
                  Slot {slot.slotOrder}
                </p>
                <p className="mt-2 text-sm text-brand-ink/70">
                  {slot.slotOrder === 1
                    ? "Producto principal destacado. Ideal para la caja mix."
                    : "Producto secundario del bloque de sabores."}
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <Field label="Producto">
                <Select
                  value={slot.productId}
                  onChange={(event) => updateSlot(slot.slotOrder, "productId", event.target.value)}
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Eyebrow">
                <Input
                  value={slot.eyebrow}
                  onChange={(event) => updateSlot(slot.slotOrder, "eyebrow", event.target.value)}
                />
              </Field>

              <Field label="Titulo">
                <Textarea
                  value={slot.title}
                  rows={2}
                  onChange={(event) => updateSlot(slot.slotOrder, "title", event.target.value)}
                />
              </Field>

              <Field label="Descripcion">
                <Textarea
                  value={slot.description}
                  rows={3}
                  onChange={(event) => updateSlot(slot.slotOrder, "description", event.target.value)}
                />
              </Field>

              <Field label="Frase / testimonio corto">
                <Textarea
                  value={slot.quote}
                  rows={3}
                  onChange={(event) => updateSlot(slot.slotOrder, "quote", event.target.value)}
                />
              </Field>

              <Field label="Texto del boton">
                <Input
                  value={slot.buttonLabel}
                  onChange={(event) => updateSlot(slot.slotOrder, "buttonLabel", event.target.value)}
                />
              </Field>
            </div>
          </Card>
        ))}
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
        {isPending ? "Guardando..." : "Guardar productos del home"}
      </Button>
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
