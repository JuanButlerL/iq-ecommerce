"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

// The token travels in the URL fragment, so it is read here and posted only when the person clicks.
// Email scanners that open links do not run this click, so they cannot burn the one-time token.
export function ReferralLoginConfirm() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const value = window.location.hash.replace(/^#/, "");
    setToken(value || "");
    // Takes the token out of the address bar and the history.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  function handleClick() {
    if (!token) return;
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/referidos/sesion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? "No pudimos validar el link.");
        return;
      }

      window.location.assign("/referidos");
    });
  }

  if (token === null) {
    return <p className="text-sm text-brand-ink/60">Cargando...</p>;
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-brand-ink/70">Este link no es válido. Pedí uno nuevo con tu DNI.</p>
        <Link href="/referidos" className="font-bold text-brand-pink underline">
          Volver al portal
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button type="button" className="w-full" onClick={handleClick} disabled={isPending || Boolean(error)}>
        {isPending ? "Entrando..." : "Entrar a mi portal"}
      </Button>
      {error ? (
        <div className="space-y-2">
          <p className="text-sm font-bold text-red-600">{error}</p>
          <Link href="/referidos" className="text-sm font-bold text-brand-pink underline">
            Pedir un link nuevo
          </Link>
        </div>
      ) : null}
    </div>
  );
}
