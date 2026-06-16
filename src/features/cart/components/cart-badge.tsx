"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";

import { useCartStore } from "@/features/cart/store";
import { cn } from "@/lib/utils/cn";

type CartBadgeProps = {
  className?: string;
  iconClassName?: string;
  countClassName?: string;
};

export function CartBadge({ className, iconClassName, countClassName }: CartBadgeProps) {
  const itemCount = useCartStore((state) => state.items.reduce((acc, item) => acc + item.quantity, 0));

  return (
    <Link
      href="/carrito"
      className={cn(
        "relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-ink shadow-card ring-1 ring-brand-ink/10",
        className,
      )}
      aria-label="Ir al carrito"
    >
      <ShoppingCart className={cn("h-5 w-5", iconClassName)} />
      <span
        className={cn(
          "absolute -right-1 -top-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-pink px-1 text-xs font-bold text-white",
          countClassName,
        )}
      >
        {itemCount}
      </span>
    </Link>
  );
}
