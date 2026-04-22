"use client";

import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type MercadoPagoRedirectCardProps = {
  initPoint: string;
};

export function MercadoPagoRedirectCard({ initPoint }: MercadoPagoRedirectCardProps) {
  return (
    <div className="rounded-[2rem] border border-brand-ink/8 bg-white p-5 shadow-[0_18px_40px_rgba(44,34,65,0.06)]">
      <Button
        size="lg"
        className="w-full bg-[#009ee3] hover:bg-[#0087c1]"
        onClick={() => window.location.assign(initPoint)}
      >
        Ir a Mercado Pago
        <ArrowUpRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
