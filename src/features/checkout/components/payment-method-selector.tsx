"use client";

import { CreditCard, Landmark, CheckCircle2 } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";

import { cn } from "@/lib/utils/cn";

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
        {visibleOptions.map((option) => {
          const Icon = option.icon;
          const selected = value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              className={cn(
                "relative rounded-[1.7rem] border px-4 py-4 text-left transition md:px-5",
                selected
                  ? "border-brand-pink bg-[#fff7f8] shadow-[0_16px_34px_rgba(244,137,145,0.14)]"
                  : "border-brand-ink/10 bg-white hover:border-brand-pink/25",
              )}
              onClick={() => onChange(option.value)}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    option.value === "MERCADO_PAGO"
                      ? "flex h-11 items-center justify-center shrink-0"
                      : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                    option.value === "MERCADO_PAGO"
                      ? ""
                      : selected
                        ? "bg-brand-pink text-white"
                        : "bg-background text-brand-ink",
                  )}
                >
                  {option.value === "MERCADO_PAGO" ? (
                    <img
                      src="/brand/mercado-pago-logo.png"
                      alt="Mercado Pago"
                      className="h-10 w-10 object-contain"
                    />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-brand-ink">{option.title}</p>
                      <p className="mt-1 text-sm text-brand-ink/62">{option.description}</p>
                      {option.value === "BANK_TRANSFER" && bankTransferDiscountPercentage > 0 ? (
                        <p className="mt-2 text-sm font-semibold text-brand-pink">
                          {bankTransferDiscountPercentage}% de descuento pagando por transferencia
                        </p>
                      ) : null}
                    </div>
                    {selected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-pink" /> : null}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
