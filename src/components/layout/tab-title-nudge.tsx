"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useCartStore } from "@/features/cart/store";
import { getTabTitleMessages } from "@/lib/marketing/tab-title-messages";

const TITLE_ROTATION_MS = 2200;

export function TabTitleNudge() {
  const pathname = usePathname();
  const cartItemCount = useCartStore((state) => state.items.reduce((total, item) => total + item.quantity, 0));
  const titleBeforeHiddenRef = useRef("IQ Kids");
  const titleRotationTimerRef = useRef<number | null>(null);
  const restoreTitleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    titleBeforeHiddenRef.current = document.title;

    if (document.visibilityState === "visible") {
      titleBeforeHiddenRef.current = document.title;
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/admin")) {
      return;
    }

    const stopRotation = () => {
      if (titleRotationTimerRef.current !== null) {
        window.clearInterval(titleRotationTimerRef.current);
        titleRotationTimerRef.current = null;
      }
    };

    const clearRestoreTimer = () => {
      if (restoreTitleTimerRef.current !== null) {
        window.clearTimeout(restoreTitleTimerRef.current);
        restoreTitleTimerRef.current = null;
      }
    };

    const restoreTitle = () => {
      stopRotation();
      clearRestoreTimer();
      document.title = titleBeforeHiddenRef.current;

      // Some desktop browsers keep the temporary tab label unless the title is
      // re-applied on the next tick after focus/pageshow.
      restoreTitleTimerRef.current = window.setTimeout(() => {
        document.title = titleBeforeHiddenRef.current;
        restoreTitleTimerRef.current = null;
      }, 120);
    };

    const startRotation = () => {
      stopRotation();

      const messages = getTabTitleMessages({ pathname, cartItemCount });

      if (messages.length === 0) {
        return;
      }

      let currentMessageIndex = 0;
      document.title = messages[currentMessageIndex] ?? titleBeforeHiddenRef.current;

      titleRotationTimerRef.current = window.setInterval(() => {
        currentMessageIndex = (currentMessageIndex + 1) % messages.length;
        document.title = messages[currentMessageIndex] ?? titleBeforeHiddenRef.current;
      }, TITLE_ROTATION_MS);
    };

    const syncWithVisibility = () => {
      if (document.visibilityState === "hidden") {
        titleBeforeHiddenRef.current = document.title;
        startRotation();
        return;
      }

      restoreTitle();
    };

    syncWithVisibility();
    document.addEventListener("visibilitychange", syncWithVisibility);
    window.addEventListener("focus", restoreTitle);
    window.addEventListener("pageshow", restoreTitle);

    return () => {
      document.removeEventListener("visibilitychange", syncWithVisibility);
      window.removeEventListener("focus", restoreTitle);
      window.removeEventListener("pageshow", restoreTitle);
      stopRotation();
      clearRestoreTimer();

      if (document.visibilityState === "visible") {
        document.title = titleBeforeHiddenRef.current;
      }
    };
  }, [cartItemCount, pathname]);

  return null;
}
