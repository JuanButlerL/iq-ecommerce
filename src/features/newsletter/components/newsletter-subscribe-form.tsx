"use client";

import { Check, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

export function NewsletterSubscribeForm({ variant = "card", className }: { variant?: "card" | "inline"; className?: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent, website }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "No pudimos suscribirte. Probá de nuevo.");
      }

      setStatus("done");
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "No pudimos suscribirte. Probá de nuevo.");
    }
  }

  return (
    <section
      className={cn(
        variant === "card" && "overflow-hidden rounded-[2.25rem] bg-[radial-gradient(circle_at_10%_0%,rgba(255,211,92,0.28),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(123,216,247,0.25),transparent_45%),linear-gradient(120deg,#fff2f3,#fffdfa)] p-7 ring-1 ring-brand-pink/15 sm:p-10",
        className,
      )}
      aria-labelledby="newsletter-subscribe-title"
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-10">
        <div>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-pink shadow-sm">
            <Mail className="h-6 w-6" aria-hidden />
          </span>
          <h2 id="newsletter-subscribe-title" className="mt-4 font-display text-[2rem] leading-[1.05] text-brand-ink sm:text-[2.4rem]">
            Recibila en tu mail
          </h2>
          <p className="mt-3 max-w-md text-base leading-7 text-brand-ink/65">Ideas para la vianda, tips simples y novedades de IQ Kids. Sin spam: te podés dar de baja cuando quieras.</p>
        </div>

        {status === "done" ? (
          <div role="status" className="rounded-[1.75rem] bg-white p-6 shadow-card">
            <p className="flex items-center gap-2 font-display text-2xl text-brand-ink">
              <Check className="h-6 w-6 rounded-full bg-green-100 p-1 text-green-700" aria-hidden /> ¡Listo!
            </p>
            <p className="mt-2 text-sm leading-6 text-brand-ink/65">Te sumamos a la newsletter. Vas a recibir la próxima edición en tu casilla.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-[1.75rem] bg-white p-5 shadow-card sm:p-6" noValidate>
            <label className="block">
              <span className="sr-only">Tu email</span>
              <Input type="email" inputMode="email" autoComplete="email" required placeholder="tu@email.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            {/* Honeypot: hidden from people, filled by bots. */}
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} className="hidden" aria-hidden />
            <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-brand-ink/70">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-brand-ink/20 accent-brand-pink" />
              <span>Quiero recibir la newsletter y novedades de IQ Kids por email.</span>
            </label>
            {error ? <p role="alert" className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}
            <Button type="submit" className="mt-5 w-full" disabled={status === "sending" || !email || !consent}>
              {status === "sending" ? "Suscribiendo..." : "Suscribirme"}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
