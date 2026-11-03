"use client";

import Image from "next/image";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { useHydratedWholesaleCart, useWholesaleCartStore } from "@/features/wholesale/cart-store";
import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";

export type WholesaleGridProduct = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  priceArs: number;
  unitsPerDisplay: number;
  soldOut: boolean;
};

type WholesaleProductGridProps = {
  products: WholesaleGridProduct[];
  minDisplays: number;
};

const stepButton =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-ink/15 text-lg text-brand-ink transition hover:border-brand-pink hover:text-brand-pink";

export function WholesaleProductGrid({ products, minDisplays }: WholesaleProductGridProps) {
  const { items } = useHydratedWholesaleCart();
  const setQuantity = useWholesaleCartStore((state) => state.setQuantity);
  const quantityOf = (id: string) => items.find((item) => item.productId === id)?.quantity ?? 0;

  // Solo cuentan los productos que siguen a la venta.
  const lines = products
    .filter((product) => !product.soldOut)
    .map((product) => ({ product, quantity: quantityOf(product.id) }))
    .filter((line) => line.quantity > 0);
  const displays = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.product.priceArs, 0);
  const missing = Math.max(0, minDisplays - displays);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {products.map((product) => {
          const quantity = quantityOf(product.id);
          return (
            <div key={product.id} className={cn("flex flex-col overflow-hidden rounded-[2rem] bg-white shadow-card", quantity > 0 && "ring-2 ring-brand-pink")}>
              <div className="relative aspect-[4/3] bg-white">
                {product.imageUrl ? (
                  <Image src={product.imageUrl} alt={product.imageAlt || product.name} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-contain" />
                ) : null}
                {product.soldOut ? (
                  <span className="absolute left-3 top-3 rounded-full bg-brand-ink px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white">Sin stock</span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col px-4 pb-5 pt-3">
                <p className="font-display text-2xl leading-none text-brand-ink">{product.name}</p>
                {product.description ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-brand-ink/65">{product.description}</p> : null}
                <div className="mt-auto pt-4">
                  <p className="font-display text-2xl leading-none text-brand-pink tabular-nums">
                    {formatArs(product.priceArs)}
                    <span className="ml-1 font-body text-xs font-normal text-brand-ink/55">/ display</span>
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-brand-ink/50">
                    {product.unitsPerDisplay} barritas · {formatArs(Math.round(product.priceArs / Math.max(1, product.unitsPerDisplay)))} c/u
                  </p>
                  {product.soldOut ? (
                    <p className="mt-3 rounded-full bg-brand-ink/5 py-2 text-center text-sm font-bold text-brand-ink/50">Volvé pronto</p>
                  ) : quantity === 0 ? (
                    <button
                      type="button"
                      onClick={() => setQuantity(product.id, 1)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brand-pink px-4 py-2.5 text-sm font-extrabold text-white shadow-soft transition hover:bg-[#ea737d]"
                    >
                      <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                      Agregar
                    </button>
                  ) : (
                    <div className="mt-3 flex items-center justify-between gap-1.5">
                      <button type="button" aria-label={`Quitar un display de ${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)} className={stepButton}>
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        aria-label={`Displays de ${product.name}`}
                        value={quantity}
                        onChange={(event) => setQuantity(product.id, Number.parseInt(event.target.value, 10) || 0)}
                        className="h-9 w-full min-w-0 rounded-xl border border-brand-ink/15 text-center text-base tabular-nums text-brand-ink outline-none focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
                      />
                      <button type="button" aria-label={`Sumar un display de ${product.name}`} onClick={() => setQuantity(product.id, quantity + 1)} className={stepButton}>
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-center text-sm text-brand-ink/60">
        Precios por display con IVA incluido. Pedido mínimo: {minDisplays} display{minDisplays === 1 ? "" : "s"} en total, podés combinar sabores.
      </p>

      {displays > 0 ? (
        <>
          {/* Espacio para que la barra fija no tape el final de la página. */}
          <div aria-hidden="true" className="h-24" />
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-ink/10 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(44,34,65,0.08)] backdrop-blur">
            {/* Margen derecho para no quedar debajo del botón flotante de WhatsApp. */}
            <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-3 pr-[4.5rem] xl:pr-0">
              <div className="min-w-0">
                <p className="text-sm font-extrabold tabular-nums text-brand-ink">
                  {displays} display{displays === 1 ? "" : "s"} · {formatArs(subtotal)}
                </p>
                <p role="status" aria-live="polite" className={cn("text-xs", missing > 0 ? "font-bold text-brand-pink" : "text-brand-ink/55")}>
                  {missing > 0 ? (missing === 1 ? "Te falta 1 display para el mínimo" : `Te faltan ${missing} displays para el mínimo`) : "Llegaste al mínimo"}
                </p>
              </div>
              <Link
                href="/mayoristas/carrito"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-brand-pink px-5 py-3 text-sm font-extrabold text-white shadow-soft transition hover:bg-[#ea737d]"
              >
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                Ver pedido
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
