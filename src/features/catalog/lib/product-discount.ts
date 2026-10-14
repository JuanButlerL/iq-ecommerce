type DiscountableProduct = {
  priceArs: number;
  discountPercentage: number | null;
  discountStartsAt: Date | null;
  discountEndsAt: Date | null;
};

// Fields added by applyProductDiscount to storefront products.
export type ProductPricing = {
  listPriceArs: number | null;
  activeDiscountPercentage: number | null;
};

export type ProductDiscountStatus = "none" | "active" | "scheduled" | "expired";

export function getProductDiscountStatus(product: Omit<DiscountableProduct, "priceArs">, now = new Date()): ProductDiscountStatus {
  if (!product.discountPercentage || product.discountPercentage <= 0) {
    return "none";
  }

  if (product.discountStartsAt && product.discountStartsAt > now) {
    return "scheduled";
  }

  if (product.discountEndsAt && product.discountEndsAt < now) {
    return "expired";
  }

  return "active";
}

export function calculateDiscountedPrice(priceArs: number, discountPercentage: number) {
  return Math.max(Math.round((priceArs * (100 - discountPercentage)) / 100), 0);
}

/**
 * Storefront price resolution. `priceArs` becomes the price the customer pays right now, so
 * cart, checkout, order creation and tracking keep working off a single field; the list price
 * is exposed separately only while a discount is in effect.
 */
export function applyProductDiscount<T extends DiscountableProduct>(product: T, now = new Date()) {
  const isActive = getProductDiscountStatus(product, now) === "active";
  const discountPercentage = isActive ? (product.discountPercentage as number) : null;

  return {
    ...product,
    priceArs: discountPercentage ? calculateDiscountedPrice(product.priceArs, discountPercentage) : product.priceArs,
    listPriceArs: discountPercentage ? product.priceArs : null,
    activeDiscountPercentage: discountPercentage,
  };
}
