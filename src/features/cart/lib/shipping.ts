import { ShippingMode } from "@prisma/client";

import { normalizeProvinceName } from "@/lib/constants/provinces";

type Settings = {
  minimumOrderAmount: number;
  freeShippingThreshold: number;
  flatShippingPrice: number;
  shippingMode: ShippingMode;
  activeShippingRule: {
    flatPrice: number | null;
    provinces: Array<{
      active: boolean;
      provinceName: string;
      shippingPrice: number;
    }>;
  } | null;
} | null;

export type ShippingQuote = {
  shippingArs: number;
  minimumReached: boolean;
  freeShippingReached: boolean;
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
      minimumReached: false,
      freeShippingReached: false,
      message: "Configuración de tienda no disponible.",
    };
  }

  const minimumReached = subtotalArs >= settings.minimumOrderAmount;
  const freeShippingReached = subtotalArs >= settings.freeShippingThreshold;

  if (freeShippingReached) {
    return {
      shippingArs: 0,
      minimumReached,
      freeShippingReached: true,
      message: "Tu compra supera el umbral de envío gratis.",
    };
  }

  let shippingArs = settings.flatShippingPrice;

  if (settings.shippingMode === ShippingMode.PROVINCE && settings.activeShippingRule) {
    const selectedProvince = provinceName ? normalizeProvinceName(provinceName) : undefined;
    const provinceRule = settings.activeShippingRule.provinces.find(
      (province) => province.active && normalizeProvinceName(province.provinceName) === selectedProvince,
    );

    if (provinceRule) {
      shippingArs = provinceRule.shippingPrice;
    } else if (settings.activeShippingRule.flatPrice) {
      shippingArs = settings.activeShippingRule.flatPrice;
    }
  }

  return {
    shippingArs,
    minimumReached,
    freeShippingReached: false,
    message: "El pedido todavía no alcanza el envío gratis.",
  };
}
