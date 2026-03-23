"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { useCartStore } from "@/features/cart/store";

export function CartBadge() {
  const itemCount = useCartStore((state) => state.items.reduce((acc, item) => acc + item.quantity, 0));

  return (
    <Link
      href="/carrito"
      className="relative inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-ink shadow-card ring-1 ring-brand-ink/10"
      aria-label="Ir al carrito"
    >
      <ShoppingBag className="h-5 w-5" />
      <span className="absolute -right-1 -top-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-pink px-1 text-xs font-bold text-white">
        {itemCount}
      </span>
    </Link>
  );
}
