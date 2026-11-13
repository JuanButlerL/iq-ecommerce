"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { QuantitySelector } from "@/features/catalog/components/quantity-selector";
import { useWholesaleCartStore } from "@/features/wholesale/cart-store";
import { trackWholesaleAddToCart } from "@/lib/integrations/wholesale-commerce-tracking";

export function WholesalePurchasePanel({
  productId,
  productName,
  priceArs,
  unitLabel = "displays",
}: {
  productId: string;
  productName: string;
  priceArs: number;
  unitLabel?: "displays" | "bultos";
}) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] bg-white p-5 shadow-card">
        <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Cantidad de {unitLabel}</p>
        <QuantitySelector value={quantity} onChange={setQuantity} />
      </div>
      <Button
        className="w-full"
        onClick={() => {
          // Suma a lo que ya hay en el pedido.
          useWholesaleCartStore.getState().addItem({ productId, quantity });
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
