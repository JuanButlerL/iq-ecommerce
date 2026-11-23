"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReferralAccessForm({ whatsappUrl }: { whatsappUrl: string | null }) {
  const [taxId, setTaxId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ found: boolean; maskedEmail: string | null; message: string | null } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/referidos/acceso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxId }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? "No pudimos procesar el pedido. Probá de nuevo.");
        return;
      }

      setResult(payload.data);
    });
  }

  if (result && !result.found) {
    return (
      <div className="space-y-4" role="status">
        <p className="rounded-2xl bg-brand-yellow/30 px-4 py-3 text-sm font-bold leading-6 text-brand-ink">{result.message}</p>
        {whatsappUrl ? (
          <a href={whatsappUrl} className="inline-block text-sm font-bold text-brand-pink underline" target="_blank" rel="noreferrer">
            Escribinos por WhatsApp
          </a>
        ) : null}
        <div>
          <button type="button" className="text-sm font-bold text-brand-ink/60 underline" onClick={() => setResult(null)}>
            Probar con otro DNI
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="space-y-4" role="status">
        <div className="rounded-2xl bg-brand-mint px-4 py-3 text-sm leading-6 text-brand-ink">
          <p className="font-bold">¡Listo! Te mandamos el link de acceso a</p>
          <p className="font-display text-xl tracking-wide">{result.maskedEmail}</p>
          <p>Es el email de tu última compra en la web. Revisá también spam o promociones.</p>
        </div>
        <p className="text-sm leading-6 text-brand-ink/70">
          El link vence en 30 minutos.{" "}
          {whatsappUrl ? (
            <>
              Si no te llega o cambiaste de email,{" "}
              <a href={whatsappUrl} className="font-bold text-brand-pink underline" target="_blank" rel="noreferrer">
                escribinos por WhatsApp
              </a>
              .
            </>
          ) : null}
        </p>
        <button type="button" className="text-sm font-bold text-brand-ink/60 underline" onClick={() => setResult(null)}>
          Probar con otro DNI
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <label className="block space-y-2">
        <span className="text-sm font-extrabold text-brand-ink">Tu DNI</span>
        <Input
          inputMode="numeric"
          autoComplete="off"
          placeholder="Sin puntos, ej. 30123456"
          maxLength={13}
          value={taxId}
          onChange={(event) => setTaxId(event.target.value.replace(/[^\d.-]/g, ""))}
          aria-invalid={error ? "true" : "false"}
        />
      </label>
      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={isPending || taxId.replace(/\D/g, "").length < 7}>
        {isPending ? "Enviando..." : "Mandarme el link de acceso"}
      </Button>
      <p className="text-xs leading-5 text-brand-ink/55">
        Te mandamos un link al email de tu última compra en la web. Así nadie más puede entrar con tu DNI.
      </p>
    </form>
  );
}
