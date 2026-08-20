"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useCartStore } from "@/features/cart/store";
import { getMobileResumeMessage, getTabTitleMessages } from "@/lib/marketing/tab-title-messages";

const TITLE_ROTATION_MS = 2200;
const MOBILE_RESUME_MIN_AWAY_MS = 8000;
const MOBILE_RESUME_VISIBLE_MS = 4200;

function isMobileResumeEligible(pathname: string) {
  return pathname === "/carrito" || pathname === "/checkout" || pathname.startsWith("/checkout/transfer/");
}

export function TabTitleNudge() {
  const pathname = usePathname();
  const cartItemCount = useCartStore((state) => state.items.reduce((total, item) => total + item.quantity, 0));
  const [mobileResumeMessage, setMobileResumeMessage] = useState<string | null>(null);
  const titleBeforeHiddenRef = useRef("IQ Kids");
  const titleRotationTimerRef = useRef<number | null>(null);
  const hiddenAtRef = useRef<number | null>(null);
  const mobileResumeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (document.visibilityState === "visible") {
      titleBeforeHiddenRef.current = document.title;
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/admin")) {
      return;
    }

    const clearMobileResumeTimer = () => {
      if (mobileResumeTimerRef.current !== null) {
        window.clearTimeout(mobileResumeTimerRef.current);
        mobileResumeTimerRef.current = null;
      }
    };

    const hideMobileResume = () => {
      clearMobileResumeTimer();
      setMobileResumeMessage(null);
    };

    const stopRotation = () => {
      if (titleRotationTimerRef.current !== null) {
        window.clearInterval(titleRotationTimerRef.current);
        titleRotationTimerRef.current = null;
      }
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

    const maybeShowMobileResume = () => {
      const hiddenAt = hiddenAtRef.current;

      if (typeof window === "undefined" || hiddenAt === null) {
        return;
      }

      const wasAwayLongEnough = Date.now() - hiddenAt >= MOBILE_RESUME_MIN_AWAY_MS;
      const isMobileViewport = window.matchMedia("(max-width: 767px)").matches;

      if (!wasAwayLongEnough || !isMobileViewport || !isMobileResumeEligible(pathname)) {
        return;
      }

      setMobileResumeMessage(getMobileResumeMessage({ pathname, cartItemCount }));
      clearMobileResumeTimer();
      mobileResumeTimerRef.current = window.setTimeout(() => {
        setMobileResumeMessage(null);
        mobileResumeTimerRef.current = null;
      }, MOBILE_RESUME_VISIBLE_MS);
    };

    const syncWithVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        titleBeforeHiddenRef.current = document.title;
        startRotation();
        return;
      }

      stopRotation();
      document.title = titleBeforeHiddenRef.current;
      maybeShowMobileResume();
    };

    syncWithVisibility();
    document.addEventListener("visibilitychange", syncWithVisibility);

    return () => {
      document.removeEventListener("visibilitychange", syncWithVisibility);
      stopRotation();
      hideMobileResume();

      if (document.visibilityState === "visible") {
        document.title = titleBeforeHiddenRef.current;
      }
    };
  }, [cartItemCount, pathname]);

  const handleResume = () => {
    setMobileResumeMessage(null);
    document.querySelector("main")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {mobileResumeMessage ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4 md:hidden">
          <div className="pointer-events-auto flex w-full max-w-sm items-center justify-between gap-3 rounded-full border border-brand-pink/18 bg-white/96 px-4 py-3 shadow-[0_18px_45px_rgba(44,34,65,0.18)] backdrop-blur">
            <p className="min-w-0 text-sm font-semibold text-brand-ink">{mobileResumeMessage}</p>
            <button
              type="button"
              className="shrink-0 rounded-full bg-brand-pink px-3 py-1.5 text-xs font-extrabold text-white transition hover:bg-[#ef7f89]"
              onClick={handleResume}
            >
              Seguir
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
