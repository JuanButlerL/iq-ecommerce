export const CART_ITEM_ADDED_EVENT = "iqkids:cart-item-added";

export type CartItemAddedDetail = {
  productName: string;
  quantity: number;
};

export function announceCartItemAdded(detail: CartItemAddedDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<CartItemAddedDetail>(CART_ITEM_ADDED_EVENT, { detail }));
}
