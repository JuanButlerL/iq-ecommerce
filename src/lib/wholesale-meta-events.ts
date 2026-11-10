// El canal mayorista usa el mismo pixel que la tienda, pero con eventos propios: así sus compras
// (displays de $16.000 en adelante) no se mezclan con las minoristas en las campañas que optimizan por compra.
// En Meta se arman conversiones personalizadas con estos nombres.
export const WHOLESALE_META_EVENTS = {
  viewContent: "ViewContentMayorista",
  addToCart: "AddToCartMayorista",
  initiateCheckout: "InitiateCheckoutMayorista",
  purchase: "PurchaseMayorista",
} as const;

export const WHOLESALE_META_CHANNEL = "mayorista";
