import { ShippingMode } from "@prisma/client";

import type { getStoreSettings } from "@/features/settings/queries";

type Settings = Awaited<ReturnType<typeof getStoreSettings>>;

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
      message: "Configuracion de tienda no disponible.",
    };
  }

  const minimumReached = subtotalArs >= settings.minimumOrderAmount;
  const freeShippingReached = subtotalArs >= settings.freeShippingThreshold;

  if (freeShippingReached) {
    return {
      shippingArs: 0,
      minimumReached,
      freeShippingReached: true,
      message: "Tu compra supera el umbral de envio gratis.",
    };
  }

  let shippingArs = settings.flatShippingPrice;

  if (settings.shippingMode === ShippingMode.PROVINCE && settings.activeShippingRule) {
    const provinceRule = settings.activeShippingRule.provinces.find(
      (province) => province.active && province.provinceName === provinceName,
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
    message: "El pedido todavia no alcanza el envio gratis.",
  };
}
