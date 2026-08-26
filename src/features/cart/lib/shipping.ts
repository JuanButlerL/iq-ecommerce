import { normalizeProvinceName } from "@/lib/constants/provinces";

type ShippingMode = "FLAT" | "PROVINCE";

type Settings = {
  minimumOrderAmount: number;
  freeShippingThreshold: number;
  flatShippingPrice: number;
  shippingMode: ShippingMode;
  activeShippingRule: {
    flatPrice: number | null;
    discountThresholdArs?: number | null;
    discountPercentage?: number | null;
    provinces: Array<{
      active: boolean;
      provinceName: string;
      shippingPrice: number;
    }>;
  } | null;
} | null;

export type ShippingQuote = {
  shippingArs: number;
  baseShippingArs: number;
  minimumReached: boolean;
  freeShippingReached: boolean;
  shippingDiscountReached: boolean;
  shippingDiscountThresholdArs: number | null;
  shippingDiscountPercentage: number;
  message: string;
};

export function calculateShippingQuote(
  subtotalArs: number,
  provinceName: string | undefined,
  settings: Settings,
): ShippingQuote {
  if (!settings) {
    return {
      shippingArs: 0,
      baseShippingArs: 0,
      minimumReached: false,
      freeShippingReached: false,
      shippingDiscountReached: false,
      shippingDiscountThresholdArs: null,
      shippingDiscountPercentage: 0,
      message: "Configuracion de tienda no disponible.",
    };
  }

  const minimumReached = subtotalArs >= settings.minimumOrderAmount;
  let baseShippingArs = settings.flatShippingPrice;

  if (settings.shippingMode === "PROVINCE" && settings.activeShippingRule) {
    const selectedProvince = provinceName ? normalizeProvinceName(provinceName) : undefined;
    const provinceRule = settings.activeShippingRule.provinces.find(
      (province) => province.active && normalizeProvinceName(province.provinceName) === selectedProvince,
    );

    if (provinceRule) {
      baseShippingArs = provinceRule.shippingPrice;
    } else if (settings.activeShippingRule.flatPrice) {
      baseShippingArs = settings.activeShippingRule.flatPrice;
    }
  }

  const discountThresholdArs = settings.activeShippingRule?.discountThresholdArs ?? null;
  const discountPercentage = settings.activeShippingRule?.discountPercentage ?? 0;
  const freeShippingReached = subtotalArs >= settings.freeShippingThreshold;

  if (freeShippingReached) {
    return {
      shippingArs: 0,
      baseShippingArs,
      minimumReached,
      freeShippingReached: true,
      shippingDiscountReached: false,
      shippingDiscountThresholdArs: discountThresholdArs,
      shippingDiscountPercentage: discountPercentage,
      message: "Tu compra supera el umbral de envio gratis.",
    };
  }

  const shippingDiscountReached =
    Boolean(discountThresholdArs) &&
    discountPercentage > 0 &&
    subtotalArs >= Number(discountThresholdArs);
  const shippingArs = shippingDiscountReached
    ? Math.max(0, Math.round(baseShippingArs * (1 - discountPercentage / 100)))
    : baseShippingArs;

  return {
    shippingArs,
    baseShippingArs,
    minimumReached,
    freeShippingReached: false,
    shippingDiscountReached,
    shippingDiscountThresholdArs: discountThresholdArs,
    shippingDiscountPercentage: discountPercentage,
    message: "El pedido todavia no alcanza el envio gratis.",
  };
}
