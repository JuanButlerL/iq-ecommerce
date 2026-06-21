"use client";

import Link from "next/link";
import { Check, ShoppingCart, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  CART_ITEM_ADDED_EVENT,
  type CartItemAddedDetail,
} from "@/features/cart/cart-feedback-event";
import { useCartStore } from "@/features/cart/store";
import { cn } from "@/lib/utils/cn";

export function CartFeedback() {
  const itemCount = useCartStore((state) => state.items.reduce((total, item) => total + item.quantity, 0));
  const [detail, setDetail] = useState<CartItemAddedDetail | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleItemAdded = (event: Event) => {
      const nextDetail = (event as CustomEvent<CartItemAddedDetail>).detail;

      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }

      setDetail(nextDetail);
      setIsVisible(true);
      hideTimerRef.current = window.setTimeout(() => setIsVisible(false), 3200);
    };

    window.addEventListener(CART_ITEM_ADDED_EVENT, handleItemAdded);

    return () => {
      window.removeEventListener(CART_ITEM_ADDED_EVENT, handleItemAdded);

      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-x-4 bottom-24 z-[70] mx-auto max-w-md transition-all duration-300 md:absolute md:inset-x-auto md:bottom-auto md:right-8 md:top-full md:mt-3 md:mx-0 md:w-[390px]",
        isVisible && detail
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0",
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="overflow-hidden rounded-[1.4rem] border border-brand-pink/20 bg-white shadow-[0_22px_60px_rgba(44,34,65,0.22)]">
        <div className="h-1 bg-brand-pink" />
        <div className="flex items-center gap-3 p-4">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-pink text-white">
            <ShoppingCart className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-brand-pink shadow-sm">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-brand-ink">
              {detail?.quantity && detail.quantity > 1 ? `${detail.quantity} unidades agregadas` : "Agregado al carrito"}
            </p>
            <p className="mt-0.5 truncate text-sm text-brand-ink/65">{detail?.productName}</p>
            <p className="mt-1 text-xs font-bold text-brand-pink">
              Ahora tenés {itemCount} {itemCount === 1 ? "unidad" : "unidades"} en el carrito
            </p>
          </div>

          <Link
            href="/carrito"
            className="shrink-0 whitespace-nowrap rounded-full bg-brand-pink px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#EA737D]"
            onClick={() => setIsVisible(false)}
          >
            Ver carrito
          </Link>

          <button
            type="button"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brand-ink/45 transition hover:bg-brand-ink/5 hover:text-brand-ink"
            aria-label="Cerrar confirmación"
            onClick={() => setIsVisible(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
