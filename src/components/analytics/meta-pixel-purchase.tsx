"use client";

import { useEffect, useRef } from "react";

import { event } from "@/lib/pixel";

type MetaPixelPurchaseProps = {
  orderNumber: string;
  total: number;
  productIds: string[];
  itemCount: number;
};

export function MetaPixelPurchase({ orderNumber, total, productIds, itemCount }: MetaPixelPurchaseProps) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }

    const storageKey = `meta:purchase:${orderNumber}`;

    if (typeof window !== "undefined" && window.sessionStorage.getItem(storageKey)) {
      trackedRef.current = true;
      return;
    }

    event("Purchase", {
      value: total,
      currency: "ARS",
      content_ids: productIds,
      content_type: "product",
      num_items: itemCount,
    });

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, "1");
    }

    trackedRef.current = true;
  }, [itemCount, orderNumber, productIds, total]);

  return null;
}
