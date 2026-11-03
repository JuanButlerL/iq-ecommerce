"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Carrito mayorista: separado del de la tienda para que los productos y precios no se mezclen.

export const WHOLESALE_MAX_DISPLAYS_PER_LINE = 999;

export type WholesaleCartItem = {
  productId: string;
  quantity: number;
};

type WholesaleCartState = {
  items: WholesaleCartItem[];
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
};

export const useWholesaleCartStore = create<WholesaleCartState>()(
  persist(
    (set, get) => ({
      items: [],
      setQuantity: (productId, quantity) => {
        const next = Math.min(Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0)), WHOLESALE_MAX_DISPLAYS_PER_LINE);
        const others = get().items.filter((item) => item.productId !== productId);

        if (next === 0) {
          set({ items: others });
          return;
        }

        const exists = get().items.some((item) => item.productId === productId);
        set({
          items: exists
            ? get().items.map((item) => (item.productId === productId ? { ...item, quantity: next } : item))
            : [...others, { productId, quantity: next }],
        });
      },
      clear: () => set({ items: [] }),
    }),
    {
      name: "iqkids-wholesale-cart",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// El carrito vive en localStorage: hasta montar en el navegador se muestra vacío para no romper la hidratación.
export function useHydratedWholesaleCart() {
  const items = useWholesaleCartStore((state) => state.items);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return { items: hydrated ? items : [], hydrated };
}
