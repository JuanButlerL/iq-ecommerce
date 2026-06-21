"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { announceCartItemAdded } from "@/features/cart/cart-feedback-event";
import { useCartStore } from "@/features/cart/store";
import { trackEvent } from "@/lib/integrations/google-analytics/client";
import { event as trackMetaEvent } from "@/lib/pixel";

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
        trackEvent("add_to_cart", {
          currency: "ARS",
          value: priceArs * initialQuantity,
          items: [
            {
              item_id: productId,
              item_name: productName,
              item_category: "Productos",
              price: priceArs,
              quantity: initialQuantity,
            },
          ],
        });
        trackMetaEvent("AddToCart", {
          content_ids: [productId],
          content_name: productName,
          content_type: "product",
          currency: "ARS",
          value: priceArs * initialQuantity,
          num_items: initialQuantity,
        });
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1200);
      }}
    >
      {added ? "Agregado al carrito" : "Agregar al carrito"}
    </Button>
  );
}
