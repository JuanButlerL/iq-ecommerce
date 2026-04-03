"use client";

import { cn } from "@/lib/utils/cn";

type PaymentBrandBadge = {
  label: string;
  className: string;
};

const mercadoPagoBrands: PaymentBrandBadge[] = [
  { label: "VISA", className: "text-[#1a1f71]" },
  { label: "mastercard", className: "text-[#ea001b]" },
  { label: "AMEX", className: "text-[#006fcf]" },
  { label: "Naranja X", className: "text-[#ff6600]" },
  { label: "CABAL", className: "text-[#00529b]" },
];

export function PaymentBrandBadges() {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-ink/45">Paga con</p>
      <div className="flex flex-wrap gap-2">
        {mercadoPagoBrands.map((brand) => (
          <span
            key={brand.label}
            className={cn(
              "inline-flex h-9 items-center rounded-md border border-brand-ink/10 bg-white px-3 text-sm font-bold shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
              brand.className,
            )}
          >
            {brand.label}
          </span>
        ))}
      </div>
    </div>
  );
}
