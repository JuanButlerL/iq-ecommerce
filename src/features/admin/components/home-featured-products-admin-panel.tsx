"use client";

import type { ReactNode } from "react";
import { useRef, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MAX_HOME_FEATURED_SLOTS } from "@/lib/validations/home-featured-product";

type ProductOption = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
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

type SlotFormItem = Omit<SlotItem, "slotOrder" | "quote"> & {
  key: string;
  quote: string;
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
  const [saved, setSaved] = useState(false);
  const nextKey = useRef(0);
  const createKey = () => `slot-${nextKey.current++}`;
  const [form, setForm] = useState<SlotFormItem[]>(() =>
    slots.map((slot) => ({
      key: createKey(),
      productId: slot.productId,
      eyebrow: slot.eyebrow,
      title: slot.title,
      description: slot.description,
      quote: slot.quote ?? "",
      buttonLabel: slot.buttonLabel,
    })),
  );

  const usedProductIds = new Set(form.map((slot) => slot.productId));
  const availableProducts = products.filter((product) => !usedProductIds.has(product.id));
  const canAddSlot = availableProducts.length > 0 && form.length < MAX_HOME_FEATURED_SLOTS;

  function changeForm(update: (current: SlotFormItem[]) => SlotFormItem[]) {
    setForm(update);
    setSaved(false);
  }

  function updateSlot(key: string, field: keyof Omit<SlotFormItem, "key">, value: string) {
    changeForm((current) => current.map((slot) => (slot.key === key ? { ...slot, [field]: value } : slot)));
  }

  function addSlot() {
    const product = availableProducts[0];

    if (!product) {
      return;
    }

    changeForm((current) => [
      ...current,
      {
        key: createKey(),
        productId: product.id,
        eyebrow: product.name,
        title: product.name,
        description: product.shortDescription,
        quote: "",
        buttonLabel: "Ver producto ->",
      },
    ]);
  }

  function removeSlot(key: string) {
    changeForm((current) => current.filter((slot) => slot.key !== key));
  }

  function moveSlot(index: number, offset: -1 | 1) {
    changeForm((current) => {
      const target = index + offset;

      if (target < 0 || target >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function submitForm() {
    const response = await fetch("/api/admin/home-featured-products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slots: form.map((slot) => ({
          productId: slot.productId,
          eyebrow: slot.eyebrow,
          title: slot.title,
          description: slot.description,
          quote: slot.quote,
          buttonLabel: slot.buttonLabel,
        })),
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "No pudimos guardar los productos del home.");
      return;
    }

    setError(null);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Home</p>
        <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Productos destacados</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-ink/70 md:text-base">
          Elegí los productos que aparecen en la landing y su orden. Hasta 4 se ven todos juntos; si agregás más, el
          bloque se recorre con scroll horizontal. El primero se destaca como &ldquo;Más elegido&rdquo;. La foto sale de
          la primera imagen del producto en Admin &gt; Productos.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {form.map((slot, index) => (
          <Card key={slot.key} className="space-y-5 p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Posición {index + 1}</p>
                <p className="mt-2 text-sm text-brand-ink/70">
                  {index === 0
                    ? "Producto principal destacado (“Más elegido”). Ideal para la caja mix."
                    : "Producto del bloque de sabores."}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Subir posición ${index + 1}`}
                  disabled={index === 0}
                  onClick={() => moveSlot(index, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Bajar posición ${index + 1}`}
                  disabled={index === form.length - 1}
                  onClick={() => moveSlot(index, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Quitar posición ${index + 1}`}
                  disabled={form.length === 1}
                  onClick={() => removeSlot(slot.key)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              <Field label="Producto">
                <Select value={slot.productId} onChange={(event) => updateSlot(slot.key, "productId", event.target.value)}>
                  {products
                    .filter((product) => product.id === slot.productId || !usedProductIds.has(product.id))
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                </Select>
              </Field>

              <Field label="Eyebrow">
                <Input value={slot.eyebrow} onChange={(event) => updateSlot(slot.key, "eyebrow", event.target.value)} />
              </Field>

              <Field label="Titulo">
                <Textarea
                  value={slot.title}
                  rows={2}
                  onChange={(event) => updateSlot(slot.key, "title", event.target.value)}
                />
              </Field>

              <Field label="Descripcion">
                <Textarea
                  value={slot.description}
                  rows={3}
                  onChange={(event) => updateSlot(slot.key, "description", event.target.value)}
                />
              </Field>

              <Field label="Frase / testimonio corto">
                <Textarea
                  value={slot.quote}
                  rows={3}
                  onChange={(event) => updateSlot(slot.key, "quote", event.target.value)}
                />
              </Field>

              <Field label="Texto del boton">
                <Input
                  value={slot.buttonLabel}
                  onChange={(event) => updateSlot(slot.key, "buttonLabel", event.target.value)}
                />
              </Field>
            </div>
          </Card>
        ))}

        <button
          type="button"
          disabled={!canAddSlot}
          onClick={addSlot}
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-[2rem] border-2 border-dashed border-brand-ink/15 p-6 text-sm font-extrabold text-brand-ink/60 transition hover:border-brand-pink/50 hover:text-brand-pink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-brand-ink/15 disabled:hover:text-brand-ink/60"
        >
          <Plus className="h-6 w-6" />
          Agregar producto
          {!canAddSlot ? (
            <span className="text-xs font-semibold">
              {availableProducts.length === 0
                ? "Ya están todos los productos en el home."
                : `Máximo ${MAX_HOME_FEATURED_SLOTS} productos.`}
            </span>
          ) : null}
        </button>
      </div>

      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm font-bold text-green-700">Guardado.</p> : null}

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
