"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product, ProductImage, ShippingRule, ShippingRuleProvince, StoreSettings } from "@prisma/client";

import { TrackEventOnView } from "@/components/analytics/track-event-on-view";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { announceCartItemAdded } from "@/features/cart/cart-feedback-event";
import { useCartStore } from "@/features/cart/store";
import { trackEvent } from "@/lib/integrations/google-analytics/client";
import { trackAddToCart } from "@/lib/integrations/commerce-tracking";
import { formatArs } from "@/lib/utils/currency";
import { calculateShippingQuote } from "@/features/cart/lib/shipping";
import { ARGENTINA_PROVINCES } from "@/lib/constants/provinces";

type ProductWithImages = Product & { images: ProductImage[] };
type SettingsWithRule = Omit<StoreSettings, "bankTransferDiscountPercentage"> & {
  bankTransferDiscountPercentage: number;
  activeShippingRule: (ShippingRule & { provinces: ShippingRuleProvince[] }) | null;
};

type CartPageProps = {
  products: ProductWithImages[];
  settings: SettingsWithRule;
};

const cartFallbackImageMap: Record<string, string> = {
  CACAO: "/home/cacao.webp",
  BANANA: "/home/banana.webp",
  PEANUT: "/home/mani.webp",
};

export function CartPage({ products, settings }: CartPageProps) {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
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
  const suggestedProducts = useMemo(() => {
    const selectedProductIds = new Set(items.map((item) => item.productId));
    const selectedFlavorCount = products.filter((product) => {
      const label = `${product.homeVarietyLabel ?? ""} ${product.name}`.toLocaleLowerCase("es");
      return selectedProductIds.has(product.id) && !label.includes("mix");
    }).length;

    if (selectedFlavorCount === 0) {
      return [];
    }

    return products.filter((product) => {
      const label = `${product.homeVarietyLabel ?? ""} ${product.name}`.toLocaleLowerCase("es");
      return !selectedProductIds.has(product.id) && !product.manualSoldOut && !label.includes("mix");
    });
  }, [items, products]);

  if (detailedItems.length === 0) {
    return (
      <EmptyState
        title="Tu carrito esta vacio"
        description="Elegí una de nuestras barritas y avanzá con un checkout rápido por transferencia."
        actionHref="/#productos"
        actionLabel="Ver productos"
      />
    );
  }

  const subtotal = detailedItems.reduce((acc, item) => acc + item.product.priceArs * item.cart.quantity, 0);
  const shippingQuote = calculateShippingQuote(subtotal, province, settings);
  const total = subtotal + shippingQuote.shippingArs;
  const checkoutHref = `/checkout?province=${encodeURIComponent(province)}`;
  const amountToFreeShipping = Math.max(0, settings.freeShippingThreshold - subtotal);
  const oneMoreUnitReachesFreeShipping =
    amountToFreeShipping > 0 &&
    products.some((product) => {
      const label = `${product.homeVarietyLabel ?? ""} ${product.name}`.toLocaleLowerCase("es");
      return !product.manualSoldOut && !label.includes("mix") && product.priceArs >= amountToFreeShipping;
    });
  const freeShippingNudge =
    amountToFreeShipping <= 0
      ? "Ya tenés envío gratis."
      : oneMoreUnitReachesFreeShipping
        ? "Sumá una unidad más para llegar al envío gratis y tener la semana resuelta."
        : `El pedido todavía no alcanza el envío gratis. Envío gratis desde: ${formatArs(settings.freeShippingThreshold)}.`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
      <TrackEventOnView
        eventName="view_cart"
        params={{
          currency: "ARS",
          value: subtotal,
          items: detailedItems.map(({ cart, product }) => ({
            item_id: product.id,
            item_name: product.name,
            item_category: "Productos",
            price: product.priceArs,
            quantity: cart.quantity,
          })),
        }}
      />
      <div className="space-y-4">
        {detailedItems.map(({ cart, product }) => (
          <Card key={product.id} className="p-4 md:flex md:items-center md:justify-between md:p-5">
            <div className="grid grid-cols-[56px_minmax(0,1fr)_88px] items-start gap-x-4 gap-y-2 md:flex md:min-w-0 md:flex-1 md:gap-4">
              <div className="relative mt-1 h-14 w-14 shrink-0 overflow-hidden bg-white md:h-20 md:w-20 md:rounded-[1.25rem]">
                <img
                  src={product.images[0]?.publicUrl ?? cartFallbackImageMap[product.colorTheme]}
                  alt={product.images[0]?.altText ?? product.name}
                  className="h-full w-full object-contain p-0.5 md:p-2"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = cartFallbackImageMap[product.colorTheme];
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
                  onClick={() => {
                    trackEvent("remove_from_cart", {
                      currency: "ARS",
                      value: product.priceArs * cart.quantity,
                      items: [
                        {
                          item_id: product.id,
                          item_name: product.name,
                          item_category: "Productos",
                          price: product.priceArs,
                          quantity: cart.quantity,
                        },
                      ],
                    });
                    removeItem(product.id);
                  }}
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
                    onClick={() => {
                      if (cart.quantity >= 99) return;
                      updateItem(product.id, cart.quantity + 1);
                      trackAddToCart({
                        productId: product.id,
                        productName: product.name,
                        priceArs: product.priceArs,
                        quantity: 1,
                      });
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {suggestedProducts.length > 0 ? (
          <div className="rounded-[1.5rem] border border-brand-ink/8 bg-white px-4 py-3 shadow-[0_10px_26px_rgba(44,34,65,0.04)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-bold leading-5 text-brand-ink">Sumar otro sabor</p>
              <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
                {suggestedProducts.map((product) => {
                  const productLabel = product.homeVarietyLabel?.trim() || product.name;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      className="shrink-0 rounded-full border border-brand-pink/22 bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-brand-ink transition hover:border-brand-pink hover:bg-brand-pink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/40"
                      onClick={() => {
                        addItem(product.id, 1);
                        announceCartItemAdded({ productName: product.name, quantity: 1 });
                        trackAddToCart({
                          productId: product.id,
                          productName: product.name,
                          priceArs: product.priceArs,
                          quantity: 1,
                        });
                      }}
                    >
                      + {productLabel}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
            <Link
              href="/#productos"
              className="inline-flex w-full items-center justify-center rounded-full border border-brand-pink/28 bg-white px-4 py-2.5 text-sm font-extrabold text-brand-pink transition hover:border-brand-pink hover:bg-brand-pink/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/30"
            >
              Ver más productos
            </Link>
        )}
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
              <span className="text-2xl font-extrabold text-brand-pink md:text-3xl">{formatArs(total)}</span>
            </div>
          </div>
        </div>
        <p className="text-sm font-bold leading-6 text-emerald-700">{freeShippingNudge}</p>
        <Link href={checkoutHref} className="block pt-2">
          <Button className="w-full">Continuar compra</Button>
        </Link>
      </Card>
    </div>
  );
}
