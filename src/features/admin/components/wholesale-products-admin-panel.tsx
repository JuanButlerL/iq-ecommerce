"use client";

import { Boxes, ChevronDown, ChevronUp, ExternalLink, Loader2, Package, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ImageField } from "@/features/admin/components/wholesale-admin-panel";
import { WHOLESALE_MAX_BOX_DISPLAYS, describeComposition, saleUnitLabel, shortProductName, type WholesaleKind } from "@/features/wholesale/bundles";
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
  highlighted: boolean;
  kind: WholesaleKind;
  boxDisplays: number;
  components: { productId: string; quantity: number }[];
};

type RetailProduct = { id: string; name: string; priceArs: number };

type WholesaleProductsAdminPanelProps = {
  products: WholesaleProductItem[];
  retailProducts: RetailProduct[];
  minDisplays: number;
};

async function request(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, headers: init.body ? { "Content-Type": "application/json" } : undefined });
  const payload = await response.json().catch(() => ({}));
  return response.ok ? null : ((payload.error as string | undefined) ?? "No pudimos guardar.");
}

const stepButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-ink/15 bg-white text-base text-brand-ink transition hover:border-brand-pink hover:text-brand-pink disabled:opacity-30";

function KindOption({ active, icon: Icon, title, text, onClick }: { active: boolean; icon: typeof Boxes; title: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-3 text-left transition",
        active ? "border-brand-pink bg-[#fff6f7] ring-1 ring-brand-pink/30" : "border-brand-ink/10 bg-white hover:border-brand-pink/40",
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", active ? "text-brand-pink" : "text-brand-ink/40")} aria-hidden="true" />
      <span>
        <span className="block text-sm font-extrabold text-brand-ink">{title}</span>
        <span className="block text-xs leading-5 text-brand-ink/60">{text}</span>
      </span>
    </button>
  );
}

function ProductRow({
  product,
  retailProducts,
  minDisplays,
  isFirst,
  isLast,
  onMove,
}: {
  product: WholesaleProductItem;
  retailProducts: RetailProduct[];
  minDisplays: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (offset: -1 | 1) => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    ...product,
    priceArs: String(product.priceArs),
    unitsPerDisplay: String(product.unitsPerDisplay),
    boxDisplays: String(product.boxDisplays),
  });
  // Cantidad por producto de la tienda (composición fija) y sabores habilitados (caja a elección).
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(product.kind === "FIXED" ? product.components.map((component) => [component.productId, component.quantity]) : []),
  );
  const [allowed, setAllowed] = useState<string[]>(() => (product.kind === "CUSTOM" ? product.components.map((component) => component.productId) : []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const price = Number(values.priceArs) || 0;
  const units = Number(values.unitsPerDisplay) || 0;
  const boxDisplays = Number(values.boxDisplays) || 0;
  const fixedComponents = retailProducts
    .filter((retail) => (quantities[retail.id] ?? 0) > 0)
    .map((retail) => ({ productId: retail.id, name: retail.name, quantity: quantities[retail.id]! }));
  const allowedComponents = retailProducts.filter((retail) => allowed.includes(retail.id)).map((retail) => ({ productId: retail.id, name: retail.name, quantity: 0 }));
  const components = values.kind === "FIXED" ? fixedComponents : allowedComponents;
  const displays = values.kind === "FIXED" ? fixedComponents.reduce((sum, component) => sum + component.quantity, 0) : boxDisplays;
  const unitLabel = saleUnitLabel({ kind: values.kind, boxDisplays, components });
  const priceLabel = values.kind === "CUSTOM" ? "Precio por caja" : displays === 0 ? "Precio" : displays === 1 ? "Precio por display" : "Precio por bulto";
  const savedUnitLabel = saleUnitLabel(product);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function setQuantity(productId: string, quantity: number) {
    setQuantities((current) => ({ ...current, [productId]: Math.min(Math.max(0, Math.floor(quantity) || 0), WHOLESALE_MAX_BOX_DISPLAYS) }));
    setSaved(false);
  }

  function toggleAllowed(productId: string, checked: boolean) {
    setAllowed((current) => (checked ? [...new Set([...current, productId])] : current.filter((id) => id !== productId)));
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
          highlighted: values.highlighted,
          kind: values.kind,
          boxDisplays: Math.round(boxDisplays),
          components: components.map(({ productId, quantity }) => ({ productId, quantity })),
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
    if (!window.confirm(`¿Eliminar “${product.name}”? Si solo querés ocultarlo, destildá “Visible en /mayoristas”. Los pedidos ya hechos no se tocan.`)) return;
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
    <Card className={cn("space-y-5 p-5 md:p-6", !product.active && "bg-white/70")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="truncate font-display text-2xl leading-none text-brand-ink">{product.name}</p>
          <span className="rounded-full bg-brand-pink/10 px-2.5 py-0.5 text-[11px] font-extrabold text-brand-pink">{savedUnitLabel}</span>
          {!product.active ? <span className="rounded-full bg-brand-ink/10 px-2.5 py-0.5 text-[11px] font-extrabold text-brand-ink/60">Oculto</span> : null}
          {product.soldOut ? <span className="rounded-full bg-brand-pink/15 px-2.5 py-0.5 text-[11px] font-extrabold text-brand-pink">Sin stock</span> : null}
          {product.highlighted ? <span className="rounded-full bg-brand-pink px-2.5 py-0.5 text-[11px] font-extrabold text-white">Más elegido</span> : null}
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

      <div className="grid gap-3 md:grid-cols-2">
        <KindOption
          active={values.kind === "FIXED"}
          icon={Package}
          title="Composición fija"
          text="Vos definís qué trae: un display suelto o un bulto (por ejemplo 3 Banana + 3 Cacao + 3 Maní + 1 Mix)."
          onClick={() => set("kind", "FIXED")}
        />
        <KindOption
          active={values.kind === "CUSTOM"}
          icon={Boxes}
          title="Armá tu caja"
          text="El cliente elige los sabores hasta llenar la caja. Vos definís cuántos displays lleva y qué sabores se pueden elegir."
          onClick={() => set("kind", "CUSTOM")}
        />
      </div>

      <div className="rounded-2xl border border-brand-ink/10 bg-brand-cream/30 p-4">
        {values.kind === "FIXED" ? (
          <>
            <p className="text-sm font-extrabold text-brand-ink">¿Qué trae cada unidad?</p>
            <p className="mt-0.5 text-xs text-brand-ink/55">Elegí cuántos displays de cada producto de la tienda. Con 1 solo display es un display suelto.</p>
            <ul className="mt-3 divide-y divide-brand-ink/10">
              {retailProducts.map((retail) => {
                const quantity = quantities[retail.id] ?? 0;
                return (
                  <li key={retail.id} className="flex items-center justify-between gap-3 py-2">
                    <span className={cn("min-w-0 truncate text-sm", quantity > 0 ? "font-extrabold text-brand-ink" : "text-brand-ink/60")}>{retail.name}</span>
                    <span className="flex items-center gap-1.5">
                      <button type="button" aria-label={`Quitar un display de ${retail.name}`} disabled={quantity === 0} onClick={() => setQuantity(retail.id, quantity - 1)} className={stepButton}>
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        aria-label={`Displays de ${retail.name}`}
                        value={quantity}
                        onChange={(event) => setQuantity(retail.id, Number.parseInt(event.target.value, 10))}
                        className="h-8 w-14 rounded-xl border border-brand-ink/15 bg-white text-center text-sm tabular-nums text-brand-ink outline-none focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
                      />
                      <button type="button" aria-label={`Sumar un display de ${retail.name}`} onClick={() => setQuantity(retail.id, quantity + 1)} className={stepButton}>
                        +
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-brand-ink">Sabores que el cliente puede elegir</p>
                <p className="mt-0.5 text-xs text-brand-ink/55">Puede repetir sabores y combinarlos como quiera hasta completar la caja.</p>
              </div>
              <label className="grid gap-1 text-xs font-bold text-brand-ink">
                Displays por caja
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={WHOLESALE_MAX_BOX_DISPLAYS}
                  step={1}
                  value={values.boxDisplays}
                  onChange={(event) => set("boxDisplays", event.target.value)}
                  className="w-28"
                />
              </label>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {retailProducts.map((retail) => (
                <Checkbox key={retail.id} label={retail.name} checked={allowed.includes(retail.id)} onChange={(event) => toggleAllowed(retail.id, event.target.checked)} />
              ))}
            </div>
          </>
        )}
        <p className={cn("mt-3 border-t border-brand-ink/10 pt-3 text-sm", components.length === 0 ? "font-bold text-red-600" : "font-bold text-brand-ink")}>
          {components.length === 0
            ? values.kind === "FIXED"
              ? "Sumá al menos un display para poder mostrarlo."
              : "Elegí al menos un sabor para poder mostrarlo."
            : values.kind === "FIXED"
              ? `${unitLabel}: ${describeComposition(components)}${units > 0 ? ` · ${displays * units} barritas` : ""}`
              : `${unitLabel} · a elegir entre ${components.map((component) => shortProductName(component.name)).join(", ")}${units > 0 && displays > 0 ? ` · ${displays * units} barritas` : ""}`}
        </p>
        {components.length > 0 && displays > 0 && displays < minDisplays ? (
          <p className="mt-1 text-xs text-brand-ink/55">
            Una unidad no llega al pedido mínimo de {minDisplays} displays: el cliente va a tener que sumar más o combinar con otros productos.
          </p>
        ) : null}
        <p className="mt-1 text-xs text-brand-ink/55">En la planilla y en la app el pedido llega abierto en estos displays. No hace falta configurar nada más.</p>
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
          {priceLabel} (ARS)
          <Input type="number" inputMode="numeric" min={1} step={1} value={values.priceArs} onChange={(event) => set("priceArs", event.target.value)} />
          <span className="text-xs font-normal text-brand-ink/50">
            {price > 0 && displays > 1 ? `${formatArs(Math.round(price / displays))} por display. ` : ""}
            {price > 0 && displays > 0 && units > 0 ? `${formatArs(Math.round(price / (displays * units)))} por barrita. ` : ""}
            Es el precio que ve y paga el comercio, con IVA.
          </span>
        </label>
        <label className="grid gap-1.5 text-sm font-bold text-brand-ink">
          Barritas por display
          <Input type="number" inputMode="numeric" min={1} step={1} value={values.unitsPerDisplay} onChange={(event) => set("unitsPerDisplay", event.target.value)} />
        </label>
        <div className="space-y-2 md:col-span-2">
          <Checkbox label="Visible en /mayoristas" checked={values.active} onChange={(event) => set("active", event.target.checked)} />
          <Checkbox label="Sin stock (se muestra pero no se puede pedir)" checked={values.soldOut} onChange={(event) => set("soldOut", event.target.checked)} />
          <Checkbox
            label="Destacar como “Más elegido” (lo lleva uno solo: si lo marcás acá, se saca del que lo tenía)"
            checked={values.highlighted}
            onChange={(event) => set("highlighted", event.target.checked)}
          />
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

  async function create(kind: WholesaleKind) {
    setBusy(true);
    setError(null);
    const failure = await request("/api/admin/wholesale-products", { method: "POST", body: JSON.stringify({ kind }) });
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
          <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Productos y bultos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/70 md:text-base">
            Todo lo que se vende en /mayoristas se arma con los displays de la tienda: displays sueltos, bultos de composición fija o cajas que arma el cliente.
            El pedido mínimo ({minDisplays} displays en total, mezclando productos) se cambia en Condiciones.
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
            key={`${product.id}-${product.name}-${product.priceArs}-${product.active}-${product.soldOut}-${product.highlighted}-${product.kind}-${product.boxDisplays}-${product.components
              .map((component) => `${component.productId}:${component.quantity}`)
              .join(",")}`}
            product={product}
            retailProducts={retailProducts}
            minDisplays={minDisplays}
            isFirst={index === 0}
            isLast={index === products.length - 1}
            onMove={(offset) => void move(index, offset)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => void create("FIXED")} disabled={busy}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nuevo bulto o display
        </Button>
        <Button type="button" variant="outline" onClick={() => void create("CUSTOM")} disabled={busy}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nueva caja “armá tu caja”
        </Button>
        {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
