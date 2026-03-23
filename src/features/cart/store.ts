"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type CartItem = {
  productId: string;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  addItem: (productId: string, quantity?: number) => void;
  updateItem: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (productId, quantity = 1) => {
        const existing = get().items.find((item) => item.productId === productId);

        if (existing) {
          set({
            items: get().items.map((item) =>
              item.productId === productId
                ? { ...item, quantity: Math.min(item.quantity + quantity, 99) }
                : item,
            ),
          });
          return;
        }

        set({
          items: [...get().items, { productId, quantity }],
        });
      },
      updateItem: (productId, quantity) => {
        if (quantity <= 0) {
          set({
            items: get().items.filter((item) => item.productId !== productId),
          });
          return;
        }

        set({
          items: get().items.map((item) => (item.productId === productId ? { ...item, quantity } : item)),
        });
      },
      removeItem: (productId) => {
        set({
          items: get().items.filter((item) => item.productId !== productId),
        });
      },
      clear: () => set({ items: [] }),
    }),
    {
      name: "iqkids-cart",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export type CartStoreItem = CartItem;
