"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { announceCartItemAdded } from "@/features/cart/cart-feedback-event";
import { useCartStore } from "@/features/cart/store";
import { trackEvent } from "@/lib/integrations/google-analytics/client";
import { event as trackMetaEvent } from "@/lib/pixel";

type HomeProductCardActionsProps = {
  productId: string;
  productName: string;
  priceArs: number;
  accent: string;
  buttonLabel: string;
  productHref: string;
};

export function HomeProductCardActions({
  productId,
  productName,
  priceArs,
  accent,
  buttonLabel,
  productHref,
}: HomeProductCardActionsProps) {
  const addItem = useCartStore((state) => state.addItem);
  const updateItem = useCartStore((state) => state.updateItem);
  const quantityInCart = useCartStore(
    (state) => state.items.find((item) => item.productId === productId)?.quantity ?? 0,
  );
  const [added, setAdded] = useState(false);

  function handleAddToCart() {
    addItem(productId, 1);
    announceCartItemAdded({ productName, quantity: 1 });
    trackEvent("add_to_cart", {
      currency: "ARS",
      value: priceArs,
      items: [
        {
          item_id: productId,
          item_name: productName,
          item_category: "Productos",
          price: priceArs,
          quantity: 1,
        },
      ],
    });
    trackMetaEvent("AddToCart", {
      content_ids: [productId],
      content_name: productName,
      content_type: "product",
      currency: "ARS",
      value: priceArs,
      num_items: 1,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  return (
    <div className="space-y-3">
      {quantityInCart === 0 ? (
        <Button
          type="button"
          className="h-11 w-full rounded-[0.9rem] bg-brand-pink text-sm font-extrabold text-white shadow-none hover:bg-[#EA737D]"
          onClick={handleAddToCart}
        >
          Agregar al carrito
        </Button>
      ) : (
        <div className="flex items-stretch gap-2">
          <div className="flex h-11 w-full items-center justify-between rounded-[0.9rem] border border-brand-ink/10 bg-white px-1 shadow-sm md:w-auto md:justify-start">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-[0.7rem] text-lg font-extrabold text-brand-ink transition hover:bg-brand-ink/5"
              aria-label="Restar cantidad"
              onClick={() => updateItem(productId, Math.max(0, quantityInCart - 1))}
            >
              -
            </button>
            <span className="flex min-w-8 justify-center text-sm font-extrabold text-brand-ink">
              {quantityInCart}
            </span>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-[0.7rem] text-lg font-extrabold text-brand-ink transition hover:bg-brand-ink/5"
              aria-label="Sumar cantidad"
              onClick={() => updateItem(productId, Math.min(99, quantityInCart + 1))}
            >
              +
            </button>
          </div>

          <Button
            type="button"
            className="hidden h-11 flex-1 rounded-[0.9rem] bg-brand-pink text-sm font-extrabold text-white shadow-none hover:bg-[#EA737D] md:inline-flex"
            onClick={handleAddToCart}
          >
            {added ? "Agregado" : "Agregar al carrito"}
          </Button>
        </div>
      )}

      <Link
        href={productHref}
        className="hidden h-11 w-full items-center justify-center rounded-[0.9rem] border text-sm font-extrabold transition md:flex"
        style={{ borderColor: accent, color: accent }}
      >
        {buttonLabel}
      </Link>
    </div>
  );
}
