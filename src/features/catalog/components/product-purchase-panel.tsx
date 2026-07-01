"use client";

import { useState } from "react";

import { AddToCartButton } from "@/features/cart/components/add-to-cart-button";
import { QuantitySelector } from "@/features/catalog/components/quantity-selector";

type ProductPurchasePanelProps = {
  productId: string;
  productName: string;
  priceArs: number;
};

export function ProductPurchasePanel({ productId, productName, priceArs }: ProductPurchasePanelProps) {
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="space-y-4">
      <div className="rounded-[2rem] bg-white p-5 shadow-card">
        <p className="mb-4 text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Cantidad</p>
        <QuantitySelector value={quantity} onChange={setQuantity} />
      </div>
      <AddToCartButton productId={productId} productName={productName} priceArs={priceArs} initialQuantity={quantity} />
    </div>
  );
}
