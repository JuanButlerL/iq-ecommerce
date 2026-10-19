"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { HOME_PRODUCTS_GRID_LIMIT } from "@/features/catalog/lib/home-products";
import { cn } from "@/lib/utils/cn";

type HomeProductsScrollerProps = {
  itemCount: number;
  children: ReactNode;
};

export function HomeProductsScroller({ itemCount, children }: HomeProductsScrollerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const scrollsOnDesktop = itemCount > HOME_PRODUCTS_GRID_LIMIT;

  const updateScrollState = useCallback(() => {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    setCanScrollBack(scroller.scrollLeft > 8);
    setCanScrollForward(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateScrollState();
    window.addEventListener("resize", updateScrollState);
    return () => window.removeEventListener("resize", updateScrollState);
  }, [updateScrollState, itemCount]);

  function scrollByPage(direction: -1 | 1) {
    const scroller = scrollerRef.current;
    scroller?.scrollBy({ left: direction * scroller.clientWidth * 0.9, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={updateScrollState}
        className={cn(
          "mt-8 flex items-stretch snap-x snap-mandatory gap-5 overflow-x-auto pb-5 pr-12 md:mt-10",
          scrollsOnDesktop
            ? "md:pr-0 [scrollbar-width:thin]"
            : "md:grid md:grid-cols-2 md:overflow-visible md:pb-0 md:pr-0 xl:grid-cols-4",
        )}
      >
        {children}
      </div>

      {/* Fade hint on the right while there is more to scroll */}
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#fff6f7] via-[#fff6f7]/75 to-transparent",
          scrollsOnDesktop ? (canScrollForward ? "" : "md:hidden") : "md:hidden",
        )}
      />

      {scrollsOnDesktop ? (
        <>
          <button
            type="button"
            aria-label="Ver productos anteriores"
            onClick={() => scrollByPage(-1)}
            disabled={!canScrollBack}
            className="absolute left-0 top-1/2 z-10 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand-ink shadow-card transition hover:text-brand-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/50 disabled:pointer-events-none disabled:opacity-0 md:flex"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Ver más productos"
            onClick={() => scrollByPage(1)}
            disabled={!canScrollForward}
            className="absolute right-0 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-white text-brand-ink shadow-card transition hover:text-brand-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/50 disabled:pointer-events-none disabled:opacity-0 md:flex"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      ) : null}
    </div>
  );
}
