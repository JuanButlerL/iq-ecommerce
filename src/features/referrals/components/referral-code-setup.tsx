"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReferralCodeSetup({ suggestedCode, terms, percentage }: { suggestedCode: string; terms: string[]; percentage: number }) {
  const router = useRouter();
  const [code, setCode] = useState(suggestedCode);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/referidos/codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendCode: code, acceptTerms: accepted }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? "No pudimos crear tu código.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block space-y-2">
        <span className="text-sm font-extrabold text-brand-ink">Elegí tu código para compartir</span>
        <Input
          value={code}
          maxLength={15}
          autoCapitalize="characters"
          placeholder={`Tu nombre + ${Math.round(percentage)}, ej. SOFI${Math.round(percentage)}`}
          onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          className="font-display text-xl tracking-wider"
        />
        <span className="block text-xs text-brand-ink/55">Entre 4 y 15 letras o números. Lo vas a poder compartir con quien quieras.</span>
      </label>

      <div className="rounded-2xl bg-brand-pinkSoft/30 p-4">
        <p className="mb-2 text-sm font-extrabold text-brand-ink">Las reglas</p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-brand-ink/75">
          {terms.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      </div>

      <label className="flex items-start gap-3 text-sm text-brand-ink">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-pink" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
        <span>Leí y acepto las reglas del Club de Familias iQ.</span>
      </label>

      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={isPending || code.length < 4 || !accepted}>
        {isPending ? "Creando..." : "Crear mis códigos"}
      </Button>
    </form>
  );
}
