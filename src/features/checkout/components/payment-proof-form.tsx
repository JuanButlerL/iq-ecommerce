"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/features/cart/store";

type PaymentProofFormProps = {
  orderNumber: string;
};

export function PaymentProofForm({ orderNumber }: PaymentProofFormProps) {
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clear);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-4 rounded-[2rem] bg-white p-6 shadow-card">
      <div>
        <h2 className="font-display text-2xl text-brand-ink md:text-3xl">Subi tu comprobante</h2>
        <p className="mt-2 text-sm text-brand-ink/70">Aceptamos JPG, PNG y PDF hasta 8 MB.</p>
      </div>
      <Input
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
      <Button
        type="button"
        className="w-full"
        disabled={!file || isPending}
        onClick={() => {
          if (!file) {
            return;
          }

          setError(null);
          startTransition(async () => {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`/api/orders/${orderNumber}/proof`, {
              method: "POST",
              body: formData,
            });

            const payload = await response.json();

            if (!response.ok) {
              setError(payload.error ?? "No pudimos subir el comprobante.");
              return;
            }

            clearCart();
            router.push(`/checkout/confirmacion/${orderNumber}`);
          });
        }}
      >
        {isPending ? "Subiendo comprobante..." : "Confirmar comprobante"}
      </Button>
    </div>
  );
}
