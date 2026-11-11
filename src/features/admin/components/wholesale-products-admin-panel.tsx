"use client";

import { ChevronDown, ChevronUp, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ImageField } from "@/features/admin/components/wholesale-admin-panel";
import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";

type WholesaleProductItem = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  priceArs: number;
  unitsPerDisplay: number;
  active: boolean;
  soldOut: boolean;
  productId: string | null;
};

type WholesaleProductsAdminPanelProps = {
  products: WholesaleProductItem[];
  retailProducts: { id: string; name: string; priceArs: number }[];
  minDisplays: number;
};

async function request(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, headers: init.body ? { "Content-Type": "application/json" } : undefined });
  const payload = await response.json();
  return response.ok ? null : ((payload.error as string | undefined) ?? "No pudimos guardar.");
}

function ProductRow({
  product,
  retailProducts,
  isFirst,
  isLast,
  onMove,
}: {
  product: WholesaleProductItem;
  retailProducts: WholesaleProductsAdminPanelProps["retailProducts"];
  isFirst: boolean;
  isLast: boolean;
  onMove: (offset: -1 | 1) => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState({ ...product, priceArs: String(product.priceArs), unitsPerDisplay: String(product.unitsPerDisplay) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const price = Number(values.priceArs) || 0;
  const units = Number(values.unitsPerDisplay) || 0;
  const linkedRetail = retailProducts.find((retail) => retail.id === values.productId);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const failure = await request(`/api/admin/wholesale-products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          imageUrl: values.imageUrl,
          imageAlt: values.imageAlt,
          priceArs: Math.round(price),
          unitsPerDisplay: Math.round(units),
          active: values.active,
          soldOut: values.soldOut,
          productId: values.productId,
        }),
      });
      if (failure) {
        setError(failure);
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar “${product.name}”? Si solo querés ocultarlo, destildá “Visible en /mayoristas”.`)) return;
    setSaving(true);
    const failure = await request(`/api/admin/wholesale-products/${product.id}`, { method: "DELETE" });
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    router.refresh();
  }

  return (
    <Card className={cn("space-y-4 p-5 md:p-6", !product.active && "bg-white/70")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-display text-2xl leading-none text-brand-ink">{product.name}</p>
          {!product.active ? <span className="rounded-full bg-brand-ink/10 px-2.5 py-0.5 text-[11px] font-extrabold text-brand-ink/60">Oculto</span> : null}
          {product.soldOut ? <span className="rounded-full bg-brand-pink/15 px-2.5 py-0.5 text-[11px] font-extrabold text-brand-pink">Sin stock</span> : null}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Subir" onClick={() => onMove(-1)} disabled={isFirst} className="rounded-full p-1.5 text-brand-ink/60 hover:bg-[#fff6f7] disabled:opacity-30">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Bajar" onClick={() => onMove(1)} disabled={isLast} className="rounded-full p-1.5 text-brand-ink/60 hover:bg-[#fff6f7] disabled:opacity-30">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Eliminar" onClick={() => void remove()} disabled={saving} className="rounded-full p-1.5 text-brand-ink/60 hover:bg-[#fff6f7] hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ImageField value={values.imageUrl} onChange={(imageUrl) => set("imageUrl", imageUrl)} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-bold text-brand-ink">
          Nombre
          <Input value={values.name} onChange={(event) => set("name", event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-brand-ink">
          Texto alternativo de la foto
          <Input value={values.imageAlt} onChange={(event) => set("imageAlt", event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-brand-ink md:col-span-2">
          Descripción
          <Input value={values.description} onChange={(event) => set("description", event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-brand-ink">
          Precio mayorista por display (ARS)
          <Input type="number" inputMode="numeric" min={1} step={1} value={values.priceArs} onChange={(event) => set("priceArs", event.target.value)} />
          <span className="text-xs font-normal text-brand-ink/50">
            {units > 0 && price > 0 ? `${formatArs(Math.round(price / units))} por unidad.` : "Es el precio que ve y paga el comercio."}
            {linkedRetail ? ` En la tienda, “${linkedRetail.name}” sale ${formatArs(linkedRetail.priceArs)}.` : ""}
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-brand-ink">
          Unidades por display
          <Input type="number" inputMode="numeric" min={1} step={1} value={values.unitsPerDisplay} onChange={(event) => set("unitsPerDisplay", event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-brand-ink">
          Producto de la tienda
          <Select value={values.productId ?? ""} onChange={(event) => set("productId", event.target.value || null)}>
            <option value="">Elegí un producto</option>
            {retailProducts.map((retail) => (
              <option key={retail.id} value={retail.id}>
                {retail.name}
              </option>
            ))}
          </Select>
          <span className={values.productId ? "text-xs font-normal text-brand-ink/50" : "text-xs font-bold text-red-600"}>
            {values.productId
              ? "Con este vínculo el pedido llega a la planilla y a la app de operaciones con el producto correcto."
              : "Obligatorio para mostrarlo en /mayoristas: con él el pedido llega a la planilla y a la app de operaciones."}
          </span>
        </label>
        <div className="space-y-2 self-end pb-1">
          <Checkbox label="Visible en /mayoristas" checked={values.active} onChange={(event) => set("active", event.target.checked)} />
          <Checkbox label="Sin stock (se muestra pero no se puede pedir)" checked={values.soldOut} onChange={(event) => set("soldOut", event.target.checked)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Guardar producto
        </Button>
        {error ? <p className="text-xs font-bold text-red-600">{error}</p> : saved ? <p className="text-xs font-bold text-emerald-700">Guardado.</p> : null}
      </div>
    </Card>
  );
}

export function WholesaleProductsAdminPanel({ products, retailProducts, minDisplays }: WholesaleProductsAdminPanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    const failure = await request("/api/admin/wholesale-products", { method: "POST" });
    setBusy(false);
    if (failure) setError(failure);
    else router.refresh();
  }

  async function move(index: number, offset: -1 | 1) {
    const ids = products.map((product) => product.id);
    const target = index + offset;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(true);
    const failure = await request("/api/admin/wholesale-products/reorder", { method: "POST", body: JSON.stringify({ ids }) });
    setBusy(false);
    if (failure) setError(failure);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Mayorista</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Productos y precios</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/70 md:text-base">
            Lo que se vende en /mayoristas, por display y con precio mayorista único y público. El pedido mínimo ({minDisplays} displays, mezclando productos) se
            cambia en Condiciones.
          </p>
        </div>
        <a
          href="/mayoristas#productos"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:ring-brand-pink/40"
        >
          Ver página
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {products.length === 0 ? <Card className="p-8 text-center text-sm text-brand-ink/60">Todavía no hay productos mayoristas.</Card> : null}

      <div className={cn("space-y-4", busy && "pointer-events-none opacity-60")}>
        {products.map((product, index) => (
          <ProductRow
            key={`${product.id}-${product.name}-${product.priceArs}-${product.active}-${product.soldOut}`}
            product={product}
            retailProducts={retailProducts}
            isFirst={index === 0}
            isLast={index === products.length - 1}
            onMove={(offset) => void move(index, offset)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => void create()} disabled={busy}>
          <Plus className="mr-1.5 h-4 w-4" />
          Agregar producto
        </Button>
        {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
