"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useState } from "react";

import { HomeProductsScroller } from "@/features/catalog/components/home-products-scroller";
import { ProductCardActionsView } from "@/features/catalog/components/product-card-actions-view";
import { ProductPrice } from "@/features/catalog/components/product-price";
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

// Los productos mayoristas no tienen tema propio: se toma el color de la tienda según el sabor.
function getWholesaleProductTheme(name: string) {
  const normalized = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  if (normalized.includes("mix")) return { accent: "#2c2241", surface: "#ffffff" };
  if (normalized.includes("cacao")) return { accent: "#F48991", surface: "#FFF3F4" };
  if (normalized.includes("banana")) return { accent: "#ffd35c", surface: "#FFF8DF" };
  if (normalized.includes("mani")) return { accent: "#7bd8f7", surface: "#EEF9FE" };
  return { accent: "#F48991", surface: "#ffffff" };
}

export function wholesaleProductHref(id: string) {
  return `/mayoristas/productos/${id}`;
}

function WholesaleProductCardActions({ product, accent }: { product: WholesaleGridProduct; accent: string }) {
  const { items } = useHydratedWholesaleCart();
  const setQuantity = useWholesaleCartStore((state) => state.setQuantity);
  const quantity = items.find((item) => item.productId === product.id)?.quantity ?? 0;
  const [added, setAdded] = useState(false);

  return (
    <ProductCardActionsView
      quantity={quantity}
      added={added}
      accent={accent}
      buttonLabel="Ver producto →"
      productHref={wholesaleProductHref(product.id)}
      onAdd={() => {
        setQuantity(product.id, quantity + 1);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1200);
      }}
      onDecrease={() => setQuantity(product.id, quantity - 1)}
      onIncrease={() => setQuantity(product.id, quantity + 1)}
    />
  );
}

function WholesaleProductCard({ product }: { product: WholesaleGridProduct }) {
  const theme = getWholesaleProductTheme(product.name);
  const href = wholesaleProductHref(product.id);
  const unitPrice = formatArs(Math.round(product.priceArs / Math.max(1, product.unitsPerDisplay)));

  return (
    <article
      className="group flex h-auto w-[82%] min-w-0 shrink-0 snap-start self-stretch flex-col overflow-hidden rounded-[2rem] border border-brand-ink/10 bg-white text-brand-ink shadow-card transition-all duration-200 hover:-translate-y-1 md:h-full md:w-auto md:shrink"
      style={{ backgroundColor: theme.surface }}
    >
      <Link href={href} className="relative aspect-[4/3] overflow-hidden bg-white">
        {product.soldOut ? (
          <span className="absolute left-4 top-4 z-10 rounded-full bg-brand-ink px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white shadow-soft">
            Sin stock
          </span>
        ) : null}
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- misma imagen y comportamiento que la tarjeta de la tienda.
          <img
            src={product.imageUrl}
            alt={product.imageAlt || product.name}
            className="absolute inset-0 h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]"
          />
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em]" style={{ color: theme.accent }}>
            Display x {product.unitsPerDisplay}
          </p>
          <Link href={href} className="block">
            <h3 className="font-display text-2xl leading-tight">{product.name}</h3>
          </Link>
          {product.description ? <p className="whitespace-pre-line text-sm leading-6 text-brand-ink/80">{product.description}</p> : null}
        </div>
        <div className="mt-auto space-y-4">
          <div className="space-y-3">
            <div>
              <ProductPrice className="text-lg font-extrabold" priceArs={product.priceArs} />
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-ink/45">{unitPrice} por unidad</p>
            </div>
            {product.soldOut ? (
              <p className="flex h-11 items-center justify-center rounded-[0.9rem] bg-brand-ink/5 text-sm font-extrabold text-brand-ink/50">Volvé pronto</p>
            ) : (
              <WholesaleProductCardActions product={product} accent={theme.accent} />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function WholesaleProductGrid({ products, minDisplays }: { products: WholesaleGridProduct[]; minDisplays: number }) {
  return (
    <>
      <HomeProductsScroller itemCount={products.length}>
        {products.map((product) => (
          <WholesaleProductCard key={product.id} product={product} />
        ))}
      </HomeProductsScroller>
      <p className="mt-5 text-center text-sm text-brand-ink/60">
        Precios por display con IVA incluido. Pedido mínimo: {minDisplays} display{minDisplays === 1 ? "" : "s"} en total, podés combinar sabores.
      </p>
    </>
  );
}

// Barra fija con el pedido en curso. Recibe todos los productos a la venta para calcular bien el subtotal.
export function WholesaleOrderBar({ products, minDisplays }: { products: WholesaleGridProduct[]; minDisplays: number }) {
  const { items } = useHydratedWholesaleCart();
  const lines = products
    .filter((product) => !product.soldOut)
    .map((product) => ({ product, quantity: items.find((item) => item.productId === product.id)?.quantity ?? 0 }))
    .filter((line) => line.quantity > 0);
  const displays = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.product.priceArs, 0);
  const missing = Math.max(0, minDisplays - displays);

  if (displays === 0) {
    return null;
  }

  return (
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
  );
}
