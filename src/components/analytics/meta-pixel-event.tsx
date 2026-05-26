"use client";

import { useEffect, useRef } from "react";

import { event, type PixelEventOptions } from "@/lib/pixel";

type MetaPixelEventProps = {
  eventName: string;
  params?: PixelEventOptions;
  dedupeKey?: string;
};

export function MetaPixelEvent({ eventName, params = {}, dedupeKey }: MetaPixelEventProps) {
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

    event(eventName, params);
    trackedRef.current = true;
  }, [dedupeKey, eventName, params]);

  return null;
}
