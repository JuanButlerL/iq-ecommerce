"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { buildCartKey, type WholesaleSelection } from "@/features/wholesale/bundles";

// Carrito mayorista: separado del de la tienda para que los productos y precios no se mezclen.

export const WHOLESALE_MAX_DISPLAYS_PER_LINE = 999;

export type WholesaleCartItem = {
  // Identifica la línea: el id del producto, o producto + sabores elegidos en "armá tu caja".
  key: string;
  productId: string;
  quantity: number;
  // Solo en "armá tu caja": los displays elegidos de cada sabor para una caja.
  selection?: WholesaleSelection;
};

type WholesaleCartState = {
  items: WholesaleCartItem[];
  // Cantidad de una línea por su clave (para productos fijos, la clave es el id del producto).
  setQuantity: (key: string, quantity: number) => void;
  // Suma unidades; si es una caja con los mismos sabores que otra ya cargada, se suman en la misma línea.
  addItem: (item: { productId: string; quantity: number; selection?: WholesaleSelection }) => void;
  clear: () => void;
};

function clampQuantity(quantity: number) {
  return Math.min(Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0)), WHOLESALE_MAX_DISPLAYS_PER_LINE);
}

export const useWholesaleCartStore = create<WholesaleCartState>()(
  persist(
    (set, get) => ({
      items: [],
      setQuantity: (key, quantity) => {
        const next = clampQuantity(quantity);
        const items = get().items;

        if (next === 0) {
          set({ items: items.filter((item) => item.key !== key) });
          return;
        }

        set({
          items: items.some((item) => item.key === key)
            ? items.map((item) => (item.key === key ? { ...item, quantity: next } : item))
            : // Una línea nueva sin elección es un producto fijo: la clave es su id.
              [...items, { key, productId: key, quantity: next }],
        });
      },
      addItem: ({ productId, quantity, selection }) => {
        const cleanSelection = selection?.filter((entry) => entry.quantity > 0);
        const key = buildCartKey(productId, cleanSelection);
        const items = get().items;
        const current = items.find((item) => item.key === key);
        const next = clampQuantity((current?.quantity ?? 0) + quantity);

        if (next === 0) return;

        set({
          items: current
            ? items.map((item) => (item.key === key ? { ...item, quantity: next } : item))
            : [...items, { key, productId, quantity: next, ...(cleanSelection && cleanSelection.length > 0 ? { selection: cleanSelection } : {}) }],
        });
      },
      clear: () => set({ items: [] }),
    }),
    {
      name: "iqkids-wholesale-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Carritos guardados antes de los bultos: { productId, quantity } por display. La clave pasa a ser el id.
      migrate: (persisted) => {
        const state = (persisted ?? {}) as { items?: unknown };
        const items = Array.isArray(state.items) ? state.items : [];
        return {
          items: items
            .filter((item): item is { productId: string; quantity: number } => Boolean(item) && typeof item.productId === "string" && Number(item.quantity) > 0)
            .map((item) => ({ key: item.productId, productId: item.productId, quantity: clampQuantity(item.quantity) })),
        } as WholesaleCartState;
      },
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
