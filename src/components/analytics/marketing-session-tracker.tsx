"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { getBrowserMarketingContext, hasTrackedMarketingSession, markMarketingSessionTracked } from "@/lib/marketing/client";

export function MarketingSessionTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/admin")) {
      return;
    }

    if (hasTrackedMarketingSession()) {
      return;
    }

    const context = getBrowserMarketingContext();

    if (!context) {
      return;
    }

    markMarketingSessionTracked();
    void fetch("/api/marketing/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(context),
      keepalive: true,
    }).catch(() => {
      // No bloquea la UX si falla el tracking.
    });
  }, [pathname]);

  return null;
}
