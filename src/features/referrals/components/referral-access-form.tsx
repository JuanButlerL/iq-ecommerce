"use client";

import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AccessResult = { found: boolean; needsEmail: boolean; maskedEmail: string | null; message: string | null };

export function ReferralAccessForm({ whatsappUrl }: { whatsappUrl: string | null }) {
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  // Shown when the DNI has no purchases: the second step asks for an email.
  const [askEmail, setAskEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AccessResult | null>(null);
  const [sentToTypedEmail, setSentToTypedEmail] = useState(false);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setResult(null);
    setAskEmail(null);
    setEmail("");
    setError(null);
    setSentToTypedEmail(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const withEmail = Boolean(askEmail);

    startTransition(async () => {
      const response = await fetch("/api/referidos/acceso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withEmail ? { taxId, email } : { taxId }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? "No pudimos procesar el pedido. Probá de nuevo.");
        return;
      }

      const data = payload.data as AccessResult;

      if (data.needsEmail) {
        setAskEmail(data.message);
        return;
      }

      setSentToTypedEmail(withEmail);
      setResult(data);
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
          <button type="button" className="text-sm font-bold text-brand-ink/60 underline" onClick={reset}>
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
          <p>
            {sentToTypedEmail && result.maskedEmail?.endsWith(`@${email.split("@")[1] ?? ""}`)
              ? "Revisá también spam o promociones."
              : "Es el email que tenemos registrado con tu DNI. Revisá también spam o promociones."}
          </p>
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
        <button type="button" className="text-sm font-bold text-brand-ink/60 underline" onClick={reset}>
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
          readOnly={Boolean(askEmail)}
          onChange={(event) => setTaxId(event.target.value.replace(/[^\d.-]/g, ""))}
          aria-invalid={error && !askEmail ? "true" : "false"}
        />
      </label>

      {askEmail ? (
        <>
          <p className="rounded-2xl bg-brand-yellow/30 px-4 py-3 text-sm leading-6 text-brand-ink">{askEmail}</p>
          <label className="block space-y-2">
            <span className="text-sm font-extrabold text-brand-ink">Tu email</span>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="tu@email.com"
              maxLength={120}
              value={email}
              autoFocus
              onChange={(event) => setEmail(event.target.value.trim())}
              aria-invalid={error ? "true" : "false"}
            />
          </label>
        </>
      ) : null}

      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
      <Button
        type="submit"
        className="w-full"
        disabled={isPending || taxId.replace(/\D/g, "").length < 7 || (Boolean(askEmail) && !/^\S+@\S+\.\S+$/.test(email))}
      >
        {isPending ? "Enviando..." : askEmail ? "Mandarme el link" : "Mandarme el link de acceso"}
      </Button>
      {askEmail ? (
        <button type="button" className="text-sm font-bold text-brand-ink/60 underline" onClick={reset}>
          Usar otro DNI
        </button>
      ) : (
        <p className="text-xs leading-5 text-brand-ink/55">
          Si ya compraste en la web, te mandamos el link al email de tu última compra. Así nadie más puede entrar con tu DNI.
        </p>
      )}
    </form>
  );
}
