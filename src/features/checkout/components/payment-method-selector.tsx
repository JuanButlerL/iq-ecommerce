"use client";

import { CreditCard, Landmark } from "lucide-react";

import { PaymentOptionCard } from "@/features/checkout/components/payment-option-card";

type PaymentMethod = "BANK_TRANSFER" | "MERCADO_PAGO";

type PaymentMethodSelectorProps = {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
  mercadoPagoEnabled: boolean;
  bankTransferEnabled: boolean;
  bankTransferDiscountPercentage?: number;
};

const options: Array<{
  value: PaymentMethod;
  title: string;
  description: string;
  icon: typeof Landmark;
}> = [
  {
    value: "BANK_TRANSFER",
    title: "Transferencia bancaria",
    description: "Pagas y subis el comprobante.",
    icon: Landmark,
  },
  {
    value: "MERCADO_PAGO",
    title: "Mercado Pago",
    description: "Pagas online en el checkout seguro.",
    icon: CreditCard,
  },
];

export function PaymentMethodSelector({
  value,
  onChange,
  mercadoPagoEnabled,
  bankTransferEnabled,
  bankTransferDiscountPercentage = 0,
}: PaymentMethodSelectorProps) {
  const visibleOptions = options.filter((option) => {
    if (option.value === "MERCADO_PAGO") {
      return mercadoPagoEnabled;
    }

    if (option.value === "BANK_TRANSFER") {
      return bankTransferEnabled;
    }

    return true;
  });

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Pago</p>
        <h2 className="mt-1 font-display text-2xl text-brand-ink md:text-3xl">Elegí como pagar</h2>
      </div>
      <div className="grid gap-3">
        {visibleOptions.map((option) => (
          <PaymentOptionCard
            key={option.value}
            title={option.title}
            description={option.description}
            note={
              option.value === "BANK_TRANSFER" && bankTransferDiscountPercentage > 0
                ? `${bankTransferDiscountPercentage}% de descuento pagando por transferencia`
                : null
            }
            selected={value === option.value}
            onSelect={() => onChange(option.value)}
            icon={option.icon}
            logo={option.value === "MERCADO_PAGO" ? { src: "/brand/mercado-pago-logo.png", alt: "Mercado Pago" } : undefined}
          />
        ))}
      </div>
    </div>
  );
}
