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
  unitPriceArs: number;
  quantity: number;
};

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

export function buildBuyXPayYMinimumMessage(code: string, buyQuantity: number, payQuantity: number) {
  return `El cupón ${code} es un ${formatBuyXPayYLabel(buyQuantity, payQuantity)}: sumá al menos ${buyQuantity} unidades sin descuento para usarlo.`;
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
>;

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

    const result = calculateBuyXPayYCouponDiscount(eligibleLines, buyQuantity as number, payQuantity as number);

    if (result.freeUnits === 0) {
      throw new AppError(buildBuyXPayYMinimumMessage(coupon.code, buyQuantity as number, payQuantity as number), 400);
    }

    discountArs = Math.min(result.discountArs, subtotalArs);
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
