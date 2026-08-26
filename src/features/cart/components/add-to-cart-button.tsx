"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { announceCartItemAdded } from "@/features/cart/cart-feedback-event";
import { useCartStore } from "@/features/cart/store";
import { trackAddToCart } from "@/lib/integrations/commerce-tracking";

type AddToCartButtonProps = {
  productId: string;
  productName: string;
  priceArs: number;
  initialQuantity?: number;
  className?: string;
  style?: CSSProperties;
};

export function AddToCartButton({
  productId,
  productName,
  priceArs,
  initialQuantity = 1,
  className,
  style,
}: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [added, setAdded] = useState(false);

  return (
    <Button
      className={className ?? "w-full"}
      style={style}
      onClick={() => {
        addItem(productId, initialQuantity);
        announceCartItemAdded({ productName, quantity: initialQuantity });
        trackAddToCart({ productId, productName, priceArs, quantity: initialQuantity });
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1200);
      }}
    >
      {added ? "Agregado al carrito" : "Agregar al carrito"}
    </Button>
  );
}
