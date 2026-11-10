"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/features/catalog/components/quantity-selector";
import { useWholesaleCartStore } from "@/features/wholesale/cart-store";
import { trackWholesaleAddToCart } from "@/lib/integrations/wholesale-commerce-tracking";

export function WholesalePurchasePanel({ productId, productName, priceArs }: { productId: string; productName: string; priceArs: number }) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] bg-white p-5 shadow-card">
        <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Cantidad de displays</p>
        <QuantitySelector value={quantity} onChange={setQuantity} />
      </div>
      <Button
        className="w-full"
        onClick={() => {
          // Se lee del store al hacer clic: suma a lo que ya hay en el pedido.
          const { items, setQuantity: setCartQuantity } = useWholesaleCartStore.getState();
          const current = items.find((item) => item.productId === productId)?.quantity ?? 0;
          setCartQuantity(productId, current + quantity);
          trackWholesaleAddToCart({ productId, productName, priceArs, quantity });
          setAdded(true);
          window.setTimeout(() => setAdded(false), 1200);
        }}
      >
        {added ? "Agregado al carrito" : "Agregar al carrito"}
      </Button>
    </div>
  );
}
