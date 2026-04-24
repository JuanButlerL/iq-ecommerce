"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product, ProductImage, ShippingRule, ShippingRuleProvince, StoreSettings } from "@prisma/client";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useCartStore } from "@/features/cart/store";
import { formatArs } from "@/lib/utils/currency";
import { calculateShippingQuote } from "@/features/cart/lib/shipping";
import { ARGENTINA_PROVINCES } from "@/lib/constants/provinces";
import { productFallbackImageMap } from "@/features/catalog/product-theme";

type ProductWithImages = Product & { images: ProductImage[] };
type SettingsWithRule = Omit<StoreSettings, "bankTransferDiscountPercentage"> & {
  bankTransferDiscountPercentage: number;
  activeShippingRule: (ShippingRule & { provinces: ShippingRuleProvince[] }) | null;
};

type CartPageProps = {
  products: ProductWithImages[];
  settings: SettingsWithRule;
};

export function CartPage({ products, settings }: CartPageProps) {
  const items = useCartStore((state) => state.items);
  const updateItem = useCartStore((state) => state.updateItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const [province, setProvince] = useState("Buenos Aires");

  const detailedItems = useMemo(
    () =>
      items
        .map((item) => ({
          cart: item,
          product: products.find((product) => product.id === item.productId),
        }))
        .filter((entry): entry is { cart: typeof items[number]; product: ProductWithImages } => Boolean(entry.product)),
    [items, products],
  );

  if (detailedItems.length === 0) {
    return (
      <EmptyState
        title="Tu carrito esta vacio"
        description="Elegí una de nuestras barritas y avanzá con un checkout rápido por transferencia."
        actionHref="/productos"
        actionLabel="Ver productos"
      />
    );
  }

  const subtotal = detailedItems.reduce((acc, item) => acc + item.product.priceArs * item.cart.quantity, 0);
  const shippingQuote = calculateShippingQuote(subtotal, province, settings);
  const total = subtotal + shippingQuote.shippingArs;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
      <div className="space-y-4">
        {detailedItems.map(({ cart, product }) => (
          <Card key={product.id} className="p-4 md:flex md:items-center md:justify-between md:p-5">
            <div className="grid grid-cols-[56px_minmax(0,1fr)_88px] items-start gap-x-4 gap-y-2 md:flex md:min-w-0 md:flex-1 md:gap-4">
              <div className="relative mt-1 h-14 w-14 shrink-0 overflow-hidden bg-white md:h-20 md:w-20 md:rounded-[1.25rem]">
                <img
                  src={product.images[0]?.publicUrl ?? productFallbackImageMap[product.colorTheme]}
                  alt={product.images[0]?.altText ?? product.name}
                  className="h-full w-full object-contain p-0.5 md:p-2"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = productFallbackImageMap[product.colorTheme];
                  }}
                />
              </div>

              <div className="min-w-0">
                <h2 className="text-[0.95rem] font-medium leading-[1.16] text-brand-ink md:text-lg md:font-extrabold md:leading-6">
                  {product.name}
                </h2>
                <p className="mt-2 text-[0.95rem] leading-none text-brand-ink md:mt-1 md:text-sm md:text-brand-ink/60">
                  {formatArs(product.priceArs * cart.quantity)}
                </p>
              </div>

              <div className="flex flex-col items-end gap-3">
                <button
                  type="button"
                  className="text-[0.95rem] font-normal leading-none text-brand-ink/70 underline underline-offset-2 hover:text-brand-pink"
                  onClick={() => removeItem(product.id)}
                >
                  Borrar
                </button>

                <div className="inline-flex items-center border border-brand-ink/15 bg-white">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center text-xl font-light text-brand-ink/70"
                    onClick={() => updateItem(product.id, Math.max(cart.quantity - 1, 1))}
                  >
                    -
                  </button>
                  <span className="flex h-9 min-w-10 items-center justify-center text-base font-medium text-brand-ink">
                    {cart.quantity}
                  </span>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center text-xl font-light text-brand-ink/70"
                    onClick={() => updateItem(product.id, Math.min(cart.quantity + 1, 99))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="h-fit space-y-5 p-5 md:p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Resumen</p>
          <div className="mt-4 space-y-3 text-sm text-brand-ink/70">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-bold text-brand-ink">{formatArs(subtotal)}</span>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-brand-ink">Seleccionar provincia para el envío</label>
              <Select value={province} onChange={(event) => setProvince(event.target.value)}>
                {ARGENTINA_PROVINCES.map((item) => (
                  <option key={item.code} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span>Envío estimado</span>
              <span className="font-bold text-brand-ink">{formatArs(shippingQuote.shippingArs)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-brand-ink/10 pt-3">
              <span>Total estimado</span>
              <span className="font-display text-2xl text-brand-pink md:text-3xl">{formatArs(total)}</span>
            </div>
          </div>
        </div>
        <div className="rounded-[1.5rem] bg-brand-peach p-4 text-sm text-brand-ink/70">
          <p>{shippingQuote.message}</p>
          <p className="mt-2">Envío gratis desde: {formatArs(settings.freeShippingThreshold)}.</p>
        </div>
        <Link href="/checkout" className="block pt-2">
          <Button className="w-full">Continuar compra</Button>
        </Link>
        <Link href="/productos" className="block text-center text-sm text-brand-ink/70 underline underline-offset-4 hover:text-brand-pink">
          Ver más productos
        </Link>
      </Card>
    </div>
  );
}
