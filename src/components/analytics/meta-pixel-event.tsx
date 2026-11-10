"use client";

import { useEffect, useRef } from "react";

import { customEvent, event, type PixelEventOptions } from "@/lib/pixel";

type MetaPixelEventProps = {
  eventName: string;
  params?: PixelEventOptions;
  dedupeKey?: string;
  // Evento propio (trackCustom), como los del canal mayorista.
  custom?: boolean;
};

export function MetaPixelEvent({ eventName, params = {}, dedupeKey, custom = false }: MetaPixelEventProps) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }

    if (dedupeKey && typeof window !== "undefined") {
      const storageKey = `meta:${dedupeKey}`;

      if (window.sessionStorage.getItem(storageKey)) {
        trackedRef.current = true;
        return;
      }

      window.sessionStorage.setItem(storageKey, "1");
    }

    (custom ? customEvent : event)(eventName, params);
    trackedRef.current = true;
  }, [custom, dedupeKey, eventName, params]);

  return null;
}
