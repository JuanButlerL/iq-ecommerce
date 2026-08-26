"use client";

import { trackEvent } from "@/lib/integrations/google-analytics/client";
import { event as trackMetaEvent } from "@/lib/pixel";

type AddToCartTrackingInput = {
  productId: string;
  productName: string;
  priceArs: number;
  quantity: number;
};

export function trackAddToCart({ productId, productName, priceArs, quantity }: AddToCartTrackingInput) {
  const value = priceArs * quantity;

  trackEvent("add_to_cart", {
    currency: "ARS",
    value,
    items: [
      {
        item_id: productId,
        item_name: productName,
        item_category: "Productos",
        price: priceArs,
        quantity,
      },
    ],
  });

  trackMetaEvent("AddToCart", {
    content_ids: [productId],
    content_name: productName,
    content_type: "product",
    contents: [{ id: productId, quantity, item_price: priceArs }],
    currency: "ARS",
    value,
    num_items: quantity,
  });
}
