"use client";

import { useState } from "react";

import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import { QuantitySelector } from "@/features/catalog/components/quantity-selector";
import { formatArs } from "@/lib/utils/currency";

type ProductPurchasePanelProps = {
  productId: string;
  priceArs: number;
};

export function ProductPurchasePanel({ productId, priceArs }: ProductPurchasePanelProps) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] bg-white p-5 shadow-card">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Precio</p>
        <p className="mt-2 font-display text-3xl text-brand-pink md:text-4xl">{formatArs(priceArs)}</p>
      </div>
      <div className="rounded-[2rem] bg-white p-5 shadow-card">
        <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Cantidad</p>
        <QuantitySelector value={quantity} onChange={setQuantity} />
      </div>
      <AddToCartButton productId={productId} initialQuantity={quantity} />
    </div>
  );
}
