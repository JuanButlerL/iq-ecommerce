"use client";

import { useEffect, useRef } from "react";

import { buildMetaPurchaseEventId } from "@/lib/meta-event-id";
import { buildMetaPurchaseData, type MetaCommerceItem } from "@/lib/meta-commerce";
import { event } from "@/lib/pixel";

type MetaPixelPurchaseProps = {
  orderNumber: string;
  totalArs: number;
  shippingArs: number;
  items: MetaCommerceItem[];
};

export function MetaPixelPurchase({ orderNumber, totalArs, shippingArs, items }: MetaPixelPurchaseProps) {
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

    event(
      "Purchase",
      buildMetaPurchaseData({ orderNumber, totalArs, shippingArs, items }),
      { eventID: buildMetaPurchaseEventId(orderNumber) },
    );

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, "1");
    }

    trackedRef.current = true;
  }, [items, orderNumber, shippingArs, totalArs]);

  return null;
}
