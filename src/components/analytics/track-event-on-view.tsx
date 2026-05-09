"use client";

import { useEffect, useRef } from "react";

import { trackEvent } from "@/lib/integrations/google-analytics/client";

type TrackEventOnViewProps = {
  eventName: string;
  params?: Record<string, unknown>;
  dedupeKey?: string;
};

export function TrackEventOnView({ eventName, params = {}, dedupeKey }: TrackEventOnViewProps) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }

    if (dedupeKey && typeof window !== "undefined") {
      const storageKey = `ga:${dedupeKey}`;

      if (window.sessionStorage.getItem(storageKey)) {
        trackedRef.current = true;
        return;
      }

      window.sessionStorage.setItem(storageKey, "1");
    }

    trackEvent(eventName, params as Record<string, string | number | boolean | undefined>);
    trackedRef.current = true;
  }, [dedupeKey, eventName, params]);

  return null;
}
