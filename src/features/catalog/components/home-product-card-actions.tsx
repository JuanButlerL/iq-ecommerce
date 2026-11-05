"use client";

import { useState } from "react";

import { announceCartItemAdded } from "@/features/cart/cart-feedback-event";
import { useCartStore } from "@/features/cart/store";
import { ProductCardActionsView } from "@/features/catalog/components/product-card-actions-view";
import { trackAddToCart } from "@/lib/integrations/commerce-tracking";

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
    trackAddToCart({ productId, productName, priceArs, quantity: 1 });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  }

  return (
    <ProductCardActionsView
      quantity={quantityInCart}
      added={added}
      accent={accent}
      buttonLabel={buttonLabel}
      productHref={productHref}
      onAdd={handleAddToCart}
      onDecrease={() => updateItem(productId, Math.max(0, quantityInCart - 1))}
      onIncrease={() => {
        if (quantityInCart >= 99) return;
        updateItem(productId, quantityInCart + 1);
        trackAddToCart({ productId, productName, priceArs, quantity: 1 });
      }}
    />
  );
}
