"use client";

import { useEffect, useRef } from "react";

import { buildMetaPurchaseEventId, buildWholesaleMetaPurchaseEventId } from "@/lib/meta-event-id";
import { buildMetaPurchaseData, type MetaCommerceItem } from "@/lib/meta-commerce";
import { customEvent, event } from "@/lib/pixel";
import { WHOLESALE_META_CHANNEL, WHOLESALE_META_EVENTS } from "@/lib/wholesale-meta-events";

type MetaPixelPurchaseProps = {
  orderNumber: string;
  totalArs: number;
  shippingArs: number;
  items: MetaCommerceItem[];
  // Compra mayorista: evento propio para no sumarse a las compras de la tienda.
  wholesale?: boolean;
};

export function MetaPixelPurchase({ orderNumber, totalArs, shippingArs, items, wholesale = false }: MetaPixelPurchaseProps) {
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

    const data = buildMetaPurchaseData({ orderNumber, totalArs, shippingArs, items });

    if (wholesale) {
      customEvent(
        WHOLESALE_META_EVENTS.purchase,
        { ...data, channel: WHOLESALE_META_CHANNEL },
        { eventID: buildWholesaleMetaPurchaseEventId(orderNumber) },
      );
    } else {
      event("Purchase", data, { eventID: buildMetaPurchaseEventId(orderNumber) });
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, "1");
    }

    trackedRef.current = true;
  }, [items, orderNumber, shippingArs, totalArs, wholesale]);

  return null;
}
