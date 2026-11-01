export type ProductDiscountKind = "PERCENTAGE" | "BUY_X_PAY_Y";

type DiscountableProduct = {
  priceArs: number;
  discountType?: ProductDiscountKind | null;
  discountPercentage: number | null;
  discountBuyQuantity?: number | null;
  discountPayQuantity?: number | null;
  discountFreeUnitsCountForFreeShipping?: boolean | null;
  discountStartsAt: Date | null;
  discountEndsAt: Date | null;
};

// Fields added by applyProductDiscount to storefront products.
export type ProductPricing = {
  listPriceArs: number | null;
  activeDiscountPercentage: number | null;
  // Buy X pay Y promo in effect (e.g. 3 and 2 for a 3x2). Both null when there is none.
  activeBuyQuantity: number | null;
  activePayQuantity: number | null;
  activeFreeUnitsCountForFreeShipping: boolean;
};

export type ProductDiscountStatus = "none" | "active" | "scheduled" | "expired";

export const BUY_X_PAY_Y_MAX_BUY_QUANTITY = 20;

/** A buy X pay Y promo needs whole numbers with 1 <= pay < buy (2x1, 3x2, 4x3, 6x4...). */
export function isValidBuyXPayY(buyQuantity: number | null | undefined, payQuantity: number | null | undefined) {
  return (
    typeof buyQuantity === "number" &&
    typeof payQuantity === "number" &&
    Number.isInteger(buyQuantity) &&
    Number.isInteger(payQuantity) &&
    buyQuantity >= 2 &&
    buyQuantity <= BUY_X_PAY_Y_MAX_BUY_QUANTITY &&
    payQuantity >= 1 &&
    payQuantity < buyQuantity
  );
}

export function formatBuyXPayYLabel(buyQuantity: number, payQuantity: number) {
  return `${buyQuantity}x${payQuantity}`;
}

/** Free units for a quantity: every complete group of `buy` units gives `buy - pay` units free. */
export function calculateBuyXPayYFreeUnits(quantity: number, buyQuantity: number, payQuantity: number) {
  if (!isValidBuyXPayY(buyQuantity, payQuantity) || !Number.isFinite(quantity) || quantity < buyQuantity) {
    return 0;
  }

  return Math.floor(quantity / buyQuantity) * (buyQuantity - payQuantity);
}

function isBuyXPayYProduct(product: Omit<DiscountableProduct, "priceArs">) {
  return product.discountType === "BUY_X_PAY_Y";
}

function hasConfiguredDiscount(product: Omit<DiscountableProduct, "priceArs">) {
  if (isBuyXPayYProduct(product)) {
    return isValidBuyXPayY(product.discountBuyQuantity, product.discountPayQuantity);
  }

  return Boolean(product.discountPercentage && product.discountPercentage > 0);
}

export function getProductDiscountStatus(product: Omit<DiscountableProduct, "priceArs">, now = new Date()): ProductDiscountStatus {
  if (!hasConfiguredDiscount(product)) {
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

export const COUPON_EXCLUDES_DISCOUNTED_MESSAGE = "El cupón no aplica a productos que ya tienen descuento.";

type PromoLine = {
  activeDiscountPercentage: number | null;
  activeBuyQuantity?: number | null;
};

export function hasActiveProductPromo(line: PromoLine) {
  return Boolean(line.activeDiscountPercentage) || Boolean(line.activeBuyQuantity);
}

/**
 * Coupons don't stack with product discounts (percentage or buy X pay Y): they are calculated
 * only over the lines without an active product promo.
 */
export function getCouponEligibleLines<T extends PromoLine>(lines: T[]) {
  return lines.filter((line) => !hasActiveProductPromo(line));
}

export function getCouponEligibleSubtotal(
  lines: { priceArs: number; activeDiscountPercentage: number | null; activeBuyQuantity?: number | null; quantity: number }[],
) {
  return getCouponEligibleLines(lines).reduce((total, line) => total + line.priceArs * line.quantity, 0);
}

export function calculateDiscountedPrice(priceArs: number, discountPercentage: number) {
  return Math.max(Math.round((priceArs * (100 - discountPercentage)) / 100), 0);
}

type PricedLine = {
  priceArs: number;
  quantity: number;
  activeBuyQuantity?: number | null;
  activePayQuantity?: number | null;
  activeFreeUnitsCountForFreeShipping?: boolean | null;
};

/**
 * What a cart line costs. `priceArs` is already the storefront price (percentage discounts are
 * applied to it); buy X pay Y promos depend on the quantity, so they are resolved per line here.
 */
export function getProductLinePricing(line: PricedLine) {
  const freeUnits =
    line.activeBuyQuantity && line.activePayQuantity
      ? calculateBuyXPayYFreeUnits(line.quantity, line.activeBuyQuantity, line.activePayQuantity)
      : 0;
  const listLineTotalArs = line.priceArs * line.quantity;
  const freeUnitsValueArs = line.priceArs * freeUnits;

  return {
    freeUnits,
    freeUnitsValueArs,
    listLineTotalArs,
    lineTotalArs: listLineTotalArs - freeUnitsValueArs,
    promoLabel:
      freeUnits > 0 && line.activeBuyQuantity && line.activePayQuantity
        ? formatBuyXPayYLabel(line.activeBuyQuantity, line.activePayQuantity)
        : null,
  };
}

/**
 * Cart totals. `subtotalArs` is what the products cost; `freeShippingSubtotalArs` is the amount
 * compared against the free shipping threshold, which adds back the value of free promo units
 * when the promo is configured so that they count toward free shipping.
 */
export function summarizeProductLines(lines: PricedLine[]) {
  return lines.reduce(
    (totals, line) => {
      const pricing = getProductLinePricing(line);
      const countsForFreeShipping = line.activeFreeUnitsCountForFreeShipping ?? true;

      return {
        subtotalArs: totals.subtotalArs + pricing.lineTotalArs,
        freeShippingSubtotalArs:
          totals.freeShippingSubtotalArs + pricing.lineTotalArs + (countsForFreeShipping ? pricing.freeUnitsValueArs : 0),
        productPromoSavingsArs: totals.productPromoSavingsArs + pricing.freeUnitsValueArs,
      };
    },
    { subtotalArs: 0, freeShippingSubtotalArs: 0, productPromoSavingsArs: 0 },
  );
}

/**
 * Storefront price resolution. `priceArs` becomes the unit price the customer pays right now, so
 * cart, checkout, order creation and tracking keep working off a single field; the list price
 * is exposed separately only while a percentage discount is in effect. Buy X pay Y promos keep
 * the regular unit price and expose the promo so line totals can be resolved per quantity.
 */
export function applyProductDiscount<T extends DiscountableProduct>(product: T, now = new Date()): T & ProductPricing {
  const isActive = getProductDiscountStatus(product, now) === "active";
  const isBuyXPayY = isActive && isBuyXPayYProduct(product);
  const discountPercentage = isActive && !isBuyXPayY ? (product.discountPercentage as number) : null;

  return {
    ...product,
    priceArs: discountPercentage ? calculateDiscountedPrice(product.priceArs, discountPercentage) : product.priceArs,
    listPriceArs: discountPercentage ? product.priceArs : null,
    activeDiscountPercentage: discountPercentage,
    activeBuyQuantity: isBuyXPayY ? (product.discountBuyQuantity as number) : null,
    activePayQuantity: isBuyXPayY ? (product.discountPayQuantity as number) : null,
    activeFreeUnitsCountForFreeShipping: isBuyXPayY ? product.discountFreeUnitsCountForFreeShipping ?? true : true,
  };
}
