"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useCartStore } from "@/features/cart/store";
import { trackEvent } from "@/lib/integrations/google-analytics/client";

type AddToCartButtonProps = {
  productId: string;
  productName: string;
  priceArs: number;
  initialQuantity?: number;
};

export function AddToCartButton({ productId, productName, priceArs, initialQuantity = 1 }: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [added, setAdded] = useState(false);

  return (
    <Button
      className="w-full"
      onClick={() => {
        addItem(productId, initialQuantity);
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
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1200);
      }}
    >
      {added ? "Agregado al carrito" : "Agregar al carrito"}
    </Button>
  );
}
