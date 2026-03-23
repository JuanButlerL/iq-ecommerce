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

type ProductWithImages = Product & { images: ProductImage[] };
type SettingsWithRule = StoreSettings & {
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
        description="Elegi una de nuestras barritas y avanza con un checkout rapido por transferencia."
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
          <Card key={product.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-brand-ink">{product.name}</h2>
              <p className="text-sm text-brand-ink/60">{formatArs(product.priceArs)} por caja</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex items-center self-start rounded-full border border-brand-ink/10 bg-background px-2 py-1">
                <button type="button" className="h-9 w-9 rounded-full bg-white font-bold" onClick={() => updateItem(product.id, Math.max(cart.quantity - 1, 1))}>
                  -
                </button>
                <span className="min-w-10 text-center font-bold text-brand-ink">{cart.quantity}</span>
                <button type="button" className="h-9 w-9 rounded-full bg-white font-bold" onClick={() => updateItem(product.id, Math.min(cart.quantity + 1, 99))}>
                  +
                </button>
              </div>
              <p className="font-extrabold text-brand-ink sm:min-w-24 sm:text-right">{formatArs(product.priceArs * cart.quantity)}</p>
              <button type="button" className="self-start text-sm font-bold text-brand-pink" onClick={() => removeItem(product.id)}>
                Quitar
              </button>
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
              <label className="mb-2 block text-sm font-bold text-brand-ink">Seleccionar provincia para el envio</label>
              <Select value={province} onChange={(event) => setProvince(event.target.value)}>
                {ARGENTINA_PROVINCES.map((item) => (
                  <option key={item.code} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span>Envio estimado</span>
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
          <p className="mt-2">Minimo de compra: {formatArs(settings.minimumOrderAmount)} sin incluir envio.</p>
          <p>Envio gratis desde: {formatArs(settings.freeShippingThreshold)}.</p>
        </div>
        <Link href="/checkout" className="block pt-2">
          <Button className="w-full">Continuar compra</Button>
        </Link>
      </Card>
    </div>
  );
}
