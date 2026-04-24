import { PaymentMethod } from "@prisma/client";

type CheckoutPricingInput = {
  paymentMethod: PaymentMethod;
  subtotalArs: number;
  couponDiscountArs: number;
  shippingArs: number;
  enableBankTransferDiscount: boolean;
  bankTransferDiscountPercentage: number;
};

export type CheckoutPricing = {
  subtotalArs: number;
  couponDiscountArs: number;
  shippingArs: number;
  beforePaymentMethodDiscountArs: number;
  paymentMethodDiscountPercentage: number;
  paymentMethodDiscountArs: number;
  totalArs: number;
};

export function calculateCheckoutPricing(input: CheckoutPricingInput): CheckoutPricing {
  const beforePaymentMethodDiscountArs = Math.max(input.subtotalArs - input.couponDiscountArs + input.shippingArs, 0);
  const paymentMethodDiscountPercentage = getBankTransferDiscountPercentage(input);
  const paymentMethodDiscountArs =
    paymentMethodDiscountPercentage > 0
      ? Math.round(beforePaymentMethodDiscountArs * (paymentMethodDiscountPercentage / 100))
      : 0;

  return {
    subtotalArs: input.subtotalArs,
    couponDiscountArs: input.couponDiscountArs,
    shippingArs: input.shippingArs,
    beforePaymentMethodDiscountArs,
    paymentMethodDiscountPercentage,
    paymentMethodDiscountArs,
    totalArs: Math.max(beforePaymentMethodDiscountArs - paymentMethodDiscountArs, 0),
  };
}

export function getBankTransferDiscountPercentage(input: {
  paymentMethod: PaymentMethod;
  enableBankTransferDiscount: boolean;
  bankTransferDiscountPercentage: number;
}) {
  if (
    input.paymentMethod !== PaymentMethod.BANK_TRANSFER ||
    !input.enableBankTransferDiscount ||
    input.bankTransferDiscountPercentage <= 0
  ) {
    return 0;
  }

  return input.bankTransferDiscountPercentage;
}
