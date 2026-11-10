"use client";

import { customEvent } from "@/lib/pixel";
import { WHOLESALE_META_CHANNEL, WHOLESALE_META_EVENTS } from "@/lib/wholesale-meta-events";

type WholesaleAddToCartInput = {
  productId: string;
  productName: string;
  priceArs: number;
  quantity: number;
};

// Igual que trackAddToCart de la tienda, pero con el evento mayorista.
export function trackWholesaleAddToCart({ productId, productName, priceArs, quantity }: WholesaleAddToCartInput) {
  customEvent(WHOLESALE_META_EVENTS.addToCart, {
    content_ids: [productId],
    content_name: productName,
    content_type: "product",
    contents: [{ id: productId, quantity, item_price: priceArs }],
    currency: "ARS",
    value: priceArs * quantity,
    num_items: quantity,
    channel: WHOLESALE_META_CHANNEL,
  });
}
