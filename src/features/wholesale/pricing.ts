// Cálculo de un pedido mayorista. Sin dependencias: lo usan el carrito (para mostrar) y el servidor (para cobrar).

export const WHOLESALE_PAYMENT_METHODS = ["MERCADO_PAGO", "BANK_TRANSFER", "ECHEQ", "DEFERRED"] as const;
export type WholesalePaymentMethod = (typeof WHOLESALE_PAYMENT_METHODS)[number];

export const WHOLESALE_PAYMENT_METHOD_LABELS: Record<WholesalePaymentMethod, string> = {
  MERCADO_PAGO: "Mercado Pago",
  BANK_TRANSFER: "Transferencia bancaria",
  ECHEQ: "eCheq",
  DEFERRED: "Pago posterior a la entrega",
};

export type WholesaleShippingRule = {
  mode: "FLAT" | "PROVINCE";
  flatPrice: number | null;
  discountThresholdArs: number | null;
  discountPercentage: number | null;
  provinces: { active: boolean; provinceName: string; shippingPrice: number }[];
};

// Adapta la regla mayorista a lo que espera calculateShippingQuote (el mismo cálculo que la tienda).
export function buildWholesaleShippingSettings(rule: WholesaleShippingRule, freeShippingThresholdArs: number | null) {
  return {
    minimumOrderAmount: 0,
    freeShippingThreshold: freeShippingThresholdArs ?? Number.POSITIVE_INFINITY,
    flatShippingPrice: rule.flatPrice ?? 0,
    shippingMode: rule.mode,
    activeShippingRule: rule,
  };
}

export type WholesalePricingInput = {
  lines: { priceArs: number; quantity: number }[];
  extraDiscountPercentage: number;
  paymentMethod: WholesalePaymentMethod | null;
  enableBankTransferDiscount: boolean;
  bankTransferDiscountPercentage: number;
  shippingArs: number;
};

export function calculateWholesalePricing(input: WholesalePricingInput) {
  const displays = input.lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotalArs = input.lines.reduce((sum, line) => sum + line.priceArs * line.quantity, 0);
  const extraDiscountPercentage = Math.max(0, input.extraDiscountPercentage);
  const extraDiscountArs = Math.round((subtotalArs * extraDiscountPercentage) / 100);
  const discountedSubtotalArs = subtotalArs - extraDiscountArs;
  // El descuento por transferencia se calcula sobre el subtotal ya bonificado por CUIT, nunca sobre el envío.
  const transferDiscountPercentage =
    input.paymentMethod === "BANK_TRANSFER" && input.enableBankTransferDiscount ? Math.max(0, input.bankTransferDiscountPercentage) : 0;
  const transferDiscountArs = Math.round((discountedSubtotalArs * transferDiscountPercentage) / 100);

  return {
    displays,
    subtotalArs,
    extraDiscountPercentage,
    extraDiscountArs,
    transferDiscountPercentage,
    transferDiscountArs,
    shippingArs: input.shippingArs,
    totalArs: discountedSubtotalArs - transferDiscountArs + input.shippingArs,
  };
}

type AddressFields = { street: string; floor: string | null; city: string; province: string; postalCode: string };

function normalizeAddressPart(value: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// El pago diferido solo vale si el pedido va a la dirección del maestro; mayúsculas, tildes y espacios no cuentan.
export function isSameDeliveryAddress(a: AddressFields, b: AddressFields) {
  return (["street", "floor", "city", "province", "postalCode"] as const).every(
    (key) => normalizeAddressPart(a[key]) === normalizeAddressPart(b[key]),
  );
}
