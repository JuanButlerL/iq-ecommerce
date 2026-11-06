import { CheckCircle2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type PaymentOptionCardProps = {
  title: string;
  description: ReactNode;
  note?: string | null;
  selected: boolean;
  onSelect: () => void;
  // Un logo reemplaza al icono (Mercado Pago).
  icon?: LucideIcon;
  logo?: { src: string; alt: string };
  // Para usarla dentro de un role="radiogroup".
  asRadio?: boolean;
};

// Tarjeta de un medio de pago, compartida por el checkout de la tienda y el mayorista.
export function PaymentOptionCard({ title, description, note, selected, onSelect, icon: Icon, logo, asRadio = false }: PaymentOptionCardProps) {
  return (
    <button
      type="button"
      {...(asRadio ? { role: "radio", "aria-checked": selected } : {})}
      className={cn(
        "relative rounded-[1.7rem] border px-4 py-4 text-left transition md:px-5",
        selected
          ? "border-brand-pink bg-[#fff7f8] shadow-[0_16px_34px_rgba(244,137,145,0.14)]"
          : "border-brand-ink/10 bg-white hover:border-brand-pink/25",
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            logo ? "flex h-11 items-center justify-center shrink-0" : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
            logo ? "" : selected ? "bg-brand-pink text-white" : "bg-background text-brand-ink",
          )}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo chico y local, sin necesidad de optimizarlo.
            <img src={logo.src} alt={logo.alt} className="h-10 w-10 object-contain" />
          ) : Icon ? (
            <Icon className="h-5 w-5" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-brand-ink">{title}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-brand-ink/62">{description}</p>
              {note ? <p className="mt-2 text-sm font-semibold text-brand-pink">{note}</p> : null}
            </div>
            {selected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-pink" /> : null}
          </div>
        </div>
      </div>
    </button>
  );
}
