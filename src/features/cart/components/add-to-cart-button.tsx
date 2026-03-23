"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useCartStore } from "@/features/cart/store";

type AddToCartButtonProps = {
  productId: string;
  initialQuantity?: number;
};

export function AddToCartButton({ productId, initialQuantity = 1 }: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);
  const [added, setAdded] = useState(false);

  return (
    <Button
      className="w-full"
      onClick={() => {
        addItem(productId, initialQuantity);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1200);
      }}
    >
      {added ? "Agregado al carrito" : "Agregar al carrito"}
    </Button>
  );
}
