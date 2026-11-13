"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/features/catalog/components/quantity-selector";
import { shortProductName, type WholesaleSaleProduct } from "@/features/wholesale/bundles";
import { useWholesaleCartStore } from "@/features/wholesale/cart-store";
import { trackWholesaleAddToCart } from "@/lib/integrations/wholesale-commerce-tracking";
import { cn } from "@/lib/utils/cn";

const stepButton =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-ink/15 bg-white text-lg font-bold text-brand-ink transition hover:border-brand-pink hover:text-brand-pink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-brand-ink/15 disabled:hover:text-brand-ink";

// "Armá tu caja": el cliente reparte los displays de la caja entre los sabores habilitados.
export function WholesaleBoxBuilder({ product }: { product: WholesaleSaleProduct }) {
  const size = product.boxDisplays;
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [boxes, setBoxes] = useState(1);
  const [added, setAdded] = useState<number | null>(null);
  const filled = Object.values(picks).reduce((sum, quantity) => sum + quantity, 0);
  const missing = size - filled;
  const complete = missing === 0;

  const change = (productId: string, delta: number) => {
    setAdded(null);
    setPicks((current) => {
      const next = Math.max(0, (current[productId] ?? 0) + delta);
      const total = Object.entries(current).reduce((sum, [id, quantity]) => sum + (id === productId ? 0 : quantity), 0);
      return { ...current, [productId]: Math.min(next, size - total) };
    });
  };

  // Reparte la caja lo más parejo posible entre todos los sabores (el resto va a los primeros).
  const splitEvenly = () => {
    setAdded(null);
    const count = product.components.length;
    setPicks(
      Object.fromEntries(product.components.map((component, index) => [component.productId, Math.floor(size / count) + (index < size % count ? 1 : 0)])),
    );
  };

  const addToCart = () => {
    if (!complete) return;
    useWholesaleCartStore.getState().addItem({
      productId: product.id,
      quantity: boxes,
      selection: product.components.map((component) => ({ productId: component.productId, quantity: picks[component.productId] ?? 0 })),
    });
    trackWholesaleAddToCart({ productId: product.id, productName: product.name, priceArs: product.priceArs, quantity: boxes });
    setAdded(boxes);
    setPicks({});
    setBoxes(1);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Elegí los sabores</p>
          <button type="button" onClick={splitEvenly} className="text-sm font-extrabold text-brand-pink underline-offset-4 hover:underline">
            Repartir parejo
          </button>
        </div>

        <div className="mt-3" aria-hidden="true">
          <div className="h-2.5 overflow-hidden rounded-full bg-brand-ink/10">
            <div className={cn("h-full rounded-full transition-all", complete ? "bg-emerald-500" : "bg-brand-pink")} style={{ width: `${(filled / size) * 100}%` }} />
          </div>
        </div>
        <p role="status" aria-live="polite" className={cn("mt-2 text-sm font-extrabold", complete ? "text-emerald-700" : "text-brand-ink")}>
          {complete ? `¡Caja completa! ${size} de ${size} displays.` : `${filled} de ${size} displays · ${missing === 1 ? "falta 1" : `faltan ${missing}`}`}
        </p>

        <ul className="mt-4 divide-y divide-brand-ink/10">
          {product.components.map((component) => {
            const quantity = picks[component.productId] ?? 0;
            const name = shortProductName(component.name);
            return (
              <li key={component.productId} className="flex items-center justify-between gap-3 py-3">
                <span className={cn("min-w-0 text-base", quantity > 0 ? "font-extrabold text-brand-ink" : "font-bold text-brand-ink/70")}>{name}</span>
                <span className="flex items-center gap-2">
                  <button type="button" aria-label={`Quitar un display de ${name}`} disabled={quantity === 0} onClick={() => change(component.productId, -1)} className={stepButton}>
                    −
                  </button>
                  <span className="min-w-8 text-center text-lg font-extrabold tabular-nums text-brand-ink">{quantity}</span>
                  <button type="button" aria-label={`Sumar un display de ${name}`} disabled={complete} onClick={() => change(component.productId, 1)} className={stepButton}>
                    +
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] bg-white p-5 shadow-card">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Cajas con esta combinación</p>
        <QuantitySelector value={boxes} onChange={setBoxes} />
      </div>

      <Button className="w-full" disabled={!complete} onClick={addToCart}>
        {complete ? (boxes === 1 ? "Agregar caja al pedido" : `Agregar ${boxes} cajas al pedido`) : `Completá la caja (${missing === 1 ? "falta 1 display" : `faltan ${missing} displays`})`}
      </Button>

      {added ? (
        <p className="flex flex-wrap items-center justify-center gap-2 text-sm font-bold text-emerald-700">
          <Check className="h-4 w-4" aria-hidden="true" />
          {added === 1 ? "Caja agregada." : `${added} cajas agregadas.`} Podés armar otra con otra combinación.
          <Link href="/mayoristas/carrito" className="font-extrabold text-brand-pink underline underline-offset-4">
            Ver pedido
          </Link>
        </p>
      ) : null}
    </div>
  );
}
