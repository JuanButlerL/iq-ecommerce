"use client";

import { Lock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";

export function WholesalePasswordGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/mayoristas/acceso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "No pudimos validar la contraseña.");
        return;
      }
      router.refresh();
    } catch {
      setError("No pudimos validar la contraseña. Revisá tu conexión.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#fff6f7] px-4 py-16">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 text-center shadow-card sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-pinkSoft text-brand-pink">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.28em] text-brand-pink">Mayoristas</p>
        <h1 className="mt-2 font-display text-3xl leading-none text-brand-ink md:text-4xl">Acceso con contraseña</h1>
        <p className="mt-3 text-sm leading-6 text-brand-ink/65">Esta sección es privada. Ingresá la contraseña para ver el contenido.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-3 text-left">
          <label htmlFor="wholesale-password" className="sr-only">
            Contraseña
          </label>
          <Input
            id="wholesale-password"
            type="password"
            autoComplete="current-password"
            placeholder="Contraseña"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            required
          />
          {error ? (
            <p role="alert" className="text-center text-sm font-bold text-red-600">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={sending || !password}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-pink px-6 text-sm font-extrabold text-white shadow-soft transition hover:bg-[#ea737d] disabled:opacity-50"
          >
            {sending ? "Verificando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
