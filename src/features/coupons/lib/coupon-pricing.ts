import type { Coupon, CouponDiscountType } from "@prisma/client";

import { formatBuyXPayYLabel, isValidBuyXPayY } from "@/features/catalog/lib/product-discount";
import { AppError } from "@/lib/errors/app-error";
import { formatArs } from "@/lib/utils/currency";

export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase();
}

export function calculateCouponDiscount(subtotalArs: number, discountPercentage: number) {
  if (subtotalArs <= 0 || discountPercentage <= 0) {
    return 0;
  }

  return Math.round((subtotalArs * discountPercentage) / 100);
}

export function calculateFixedCouponDiscount(subtotalArs: number, fixedDiscountArs: number) {
  if (subtotalArs <= 0 || fixedDiscountArs <= 0) {
    return 0;
  }

  return Math.min(subtotalArs, fixedDiscountArs);
}

export type CouponLine = {
  // Needed when the coupon counts units per product; lines without it are treated as separate products.
  productId?: string;
  unitPriceArs: number;
  quantity: number;
};

export const BUY_X_PAY_Y_MAX_UNITS_PER_PACK = 24;

export type CouponPackUnits = Array<{ productId: string; unitsPerPack: number }>;

/** Reads the coupon pack list stored as JSON, ignoring anything malformed. */
export function parseCouponPackUnits(value: unknown): CouponPackUnits {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const { productId, unitsPerPack } = entry as { productId?: unknown; unitsPerPack?: unknown };

    if (
      typeof productId !== "string" ||
      !productId ||
      seen.has(productId) ||
      typeof unitsPerPack !== "number" ||
      !Number.isInteger(unitsPerPack) ||
      unitsPerPack < 2 ||
      unitsPerPack > BUY_X_PAY_Y_MAX_UNITS_PER_PACK
    ) {
      return [];
    }

    seen.add(productId);
    return [{ productId, unitsPerPack }];
  });
}

/**
 * A pack product (e.g. "3 display") counts as `unitsPerPack` units at a proportional price, so a
 * single pack of 3 with a 3x2 gets one display free (a third of its price). Products that are not
 * in the list keep counting as one unit each.
 */
export function expandCouponPackLines(lines: CouponLine[], packUnits: CouponPackUnits): CouponLine[] {
  if (!packUnits.length) {
    return lines;
  }

  const unitsByProduct = new Map(packUnits.map((entry) => [entry.productId, entry.unitsPerPack]));

  return lines.map((line) => {
    const unitsPerPack = line.productId ? unitsByProduct.get(line.productId) : undefined;

    return unitsPerPack
      ? { ...line, unitPriceArs: line.unitPriceArs / unitsPerPack, quantity: line.quantity * unitsPerPack }
      : line;
  });
}

/**
 * Buy X pay Y over the whole eligible cart (products can be mixed). Units are sorted from the
 * most to the least expensive and grouped by X; in each complete group the X - Y cheapest units
 * are free. That is the usual retail rule and never gives away more than the cheapest units.
 */
export function calculateBuyXPayYCouponDiscount(lines: CouponLine[], buyQuantity: number, payQuantity: number) {
  if (!isValidBuyXPayY(buyQuantity, payQuantity)) {
    return { discountArs: 0, freeUnits: 0 };
  }

  const unitPrices = lines
    .flatMap((line) =>
      line.quantity > 0 && line.unitPriceArs > 0 ? Array.from({ length: Math.floor(line.quantity) }, () => line.unitPriceArs) : [],
    )
    .sort((a, b) => b - a);
  const freePerGroup = buyQuantity - payQuantity;
  let discountArs = 0;
  let freeUnits = 0;

  for (let start = 0; start + buyQuantity <= unitPrices.length; start += buyQuantity) {
    const group = unitPrices.slice(start, start + buyQuantity);

    for (const price of group.slice(buyQuantity - freePerGroup)) {
      discountArs += price;
      freeUnits += 1;
    }
  }

  return { discountArs, freeUnits };
}

/**
 * Same rule, but each product forms its own groups: with a 3x2, 3 boxes of one flavor give one
 * free box, while one box of three different flavors gives none.
 */
export function calculateBuyXPayYCouponDiscountPerProduct(lines: CouponLine[], buyQuantity: number, payQuantity: number) {
  const linesByProduct = new Map<string, CouponLine[]>();

  lines.forEach((line, index) => {
    const key = line.productId ?? `line-${index}`;
    linesByProduct.set(key, [...(linesByProduct.get(key) ?? []), line]);
  });

  return Array.from(linesByProduct.values()).reduce(
    (total, productLines) => {
      const result = calculateBuyXPayYCouponDiscount(productLines, buyQuantity, payQuantity);
      return { discountArs: total.discountArs + result.discountArs, freeUnits: total.freeUnits + result.freeUnits };
    },
    { discountArs: 0, freeUnits: 0 },
  );
}

export function getCouponDiscountLabel(input: {
  discountType: CouponDiscountType;
  discountPercentage?: number | null;
  fixedDiscountArs?: number | null;
  buyQuantity?: number | null;
  payQuantity?: number | null;
}) {
  if (input.discountType === "FIXED_AMOUNT") {
    return `${formatArs(input.fixedDiscountArs ?? 0)} OFF`;
  }

  if (input.discountType === "BUY_X_PAY_Y") {
    return input.buyQuantity && input.payQuantity ? formatBuyXPayYLabel(input.buyQuantity, input.payQuantity) : "NxM";
  }

  return `${input.discountPercentage ?? 0}% OFF`;
}

export function buildBuyXPayYMinimumMessage(code: string, buyQuantity: number, payQuantity: number, sameProductOnly = false) {
  return sameProductOnly
    ? `El cupón ${code} es un ${formatBuyXPayYLabel(buyQuantity, payQuantity)} por producto: sumá al menos ${buyQuantity} unidades del mismo producto (sin descuento propio) para usarlo.`
    : `El cupón ${code} es un ${formatBuyXPayYLabel(buyQuantity, payQuantity)}: sumá al menos ${buyQuantity} unidades sin descuento para usarlo.`;
}

type CouponForSummary = Pick<
  Coupon,
  | "id"
  | "code"
  | "discountType"
  | "discountPercentage"
  | "fixedDiscountArs"
  | "usageType"
  | "buyQuantity"
  | "payQuantity"
  | "freeUnitsCountForFreeShipping"
  | "buyXPayYSameProductOnly"
> & { buyXPayYPackUnits?: unknown };

/**
 * @param subtotalArs eligible subtotal (lines without a product promo)
 * @param eligibleLines the same eligible lines, needed for buy X pay Y coupons
 */
export function buildCouponSummary(coupon: CouponForSummary, subtotalArs: number, eligibleLines: CouponLine[] = []) {
  const discountType = coupon.discountType;
  const discountPercentage = coupon.discountPercentage == null ? null : Number(coupon.discountPercentage);
  const fixedDiscountArs = coupon.fixedDiscountArs ?? null;
  const isBuyXPayY = discountType === "BUY_X_PAY_Y";
  const buyQuantity = isBuyXPayY ? coupon.buyQuantity ?? null : null;
  const payQuantity = isBuyXPayY ? coupon.payQuantity ?? null : null;
  let discountArs = 0;
  let freeUnits = 0;

  if (isBuyXPayY) {
    if (!isValidBuyXPayY(buyQuantity, payQuantity)) {
      throw new AppError(`El cupón ${coupon.code} no está bien configurado.`, 400);
    }

    const lines = expandCouponPackLines(eligibleLines, parseCouponPackUnits(coupon.buyXPayYPackUnits));
    const result = coupon.buyXPayYSameProductOnly
      ? calculateBuyXPayYCouponDiscountPerProduct(lines, buyQuantity as number, payQuantity as number)
      : calculateBuyXPayYCouponDiscount(lines, buyQuantity as number, payQuantity as number);

    if (result.freeUnits === 0) {
      throw new AppError(
        buildBuyXPayYMinimumMessage(coupon.code, buyQuantity as number, payQuantity as number, coupon.buyXPayYSameProductOnly),
        400,
      );
    }

    // Pack units can have fractional prices; the final discount is rounded to whole pesos.
    discountArs = Math.min(Math.round(result.discountArs), subtotalArs);
    freeUnits = result.freeUnits;
  } else if (discountType === "FIXED_AMOUNT") {
    discountArs = calculateFixedCouponDiscount(subtotalArs, fixedDiscountArs ?? 0);
  } else {
    discountArs = calculateCouponDiscount(subtotalArs, discountPercentage ?? 0);
  }

  const freeUnitsCountForFreeShipping = isBuyXPayY ? coupon.freeUnitsCountForFreeShipping : true;

  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discountType,
    discountPercentage,
    fixedDiscountArs,
    buyQuantity,
    payQuantity,
    freeUnits,
    freeUnitsCountForFreeShipping,
    sameProductOnly: isBuyXPayY ? coupon.buyXPayYSameProductOnly : false,
    // Amount taken off the free shipping threshold base. Only buy X pay Y coupons whose free
    // units must not count toward free shipping change it; other coupons never did.
    freeShippingDeductionArs: isBuyXPayY && !freeUnitsCountForFreeShipping ? discountArs : 0,
    usageType: coupon.usageType,
    discountArs,
    subtotalWithDiscountArs: Math.max(subtotalArs - discountArs, 0),
  };
}

export type CouponSummary = ReturnType<typeof buildCouponSummary>;

export function assertCouponIsApplicable<T extends Pick<Coupon, "active">>(coupon: T | null, code: string) {
  if (!coupon || !coupon.active) {
    throw new AppError(`El cupón ${normalizeCouponCode(code)} no existe o no está activo.`, 400);
  }
}
