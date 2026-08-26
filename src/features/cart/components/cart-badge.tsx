"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CART_ITEM_ADDED_EVENT } from "@/features/cart/cart-feedback-event";
import { useCartStore } from "@/features/cart/store";
import { cn } from "@/lib/utils/cn";

type CartBadgeProps = {
  className?: string;
  iconClassName?: string;
  countClassName?: string;
};

export function CartBadge({ className, iconClassName, countClassName }: CartBadgeProps) {
  const itemCount = useCartStore((state) => state.items.reduce((acc, item) => acc + item.quantity, 0));
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleItemAdded = () => {
      if (animationTimerRef.current) {
        window.clearTimeout(animationTimerRef.current);
      }

      setIsAnimating(false);
      window.requestAnimationFrame(() => setIsAnimating(true));
      animationTimerRef.current = window.setTimeout(() => setIsAnimating(false), 650);
    };

    window.addEventListener(CART_ITEM_ADDED_EVENT, handleItemAdded);

    return () => {
      window.removeEventListener(CART_ITEM_ADDED_EVENT, handleItemAdded);

      if (animationTimerRef.current) {
        window.clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

  return (
    <Link
      href="/carrito"
      className={cn(
        "relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-ink shadow-card ring-1 ring-brand-ink/10",
        isAnimating && "animate-[cart-pop_650ms_cubic-bezier(0.2,0.8,0.2,1)]",
        className,
      )}
      aria-label="Ir al carrito"
    >
      {isAnimating ? <span className="absolute inset-0 animate-ping rounded-full bg-brand-pink/25" /> : null}
      <ShoppingCart className={cn("h-5 w-5", iconClassName)} />
      <span
        className={cn(
          "absolute -right-1 -top-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-pink px-1 text-xs font-bold text-white",
          isAnimating && "scale-110",
          countClassName,
        )}
      >
        {itemCount}
      </span>
    </Link>
  );
}
