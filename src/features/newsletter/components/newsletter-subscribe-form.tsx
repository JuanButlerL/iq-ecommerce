"use client";

import { Check } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

type Variant = "band" | "compact";

// Sober subscription box. "band": full-width section at the end of a page.
// "compact": stacked version for the article sidebar.
export function NewsletterSubscribeForm({ variant = "band", className }: { variant?: Variant; className?: string }) {
  const titleId = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const compact = variant === "compact";

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

  const heading = (
    <div className={cn(!compact && "max-w-md")}>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-pink">Newsletter</p>
      <h2 id={titleId} className={cn("mt-2 font-display leading-[1.05] text-brand-ink", compact ? "text-2xl" : "text-[2rem] md:text-[2.3rem]")}>
        Recibila en tu mail
      </h2>
      <p className={cn("mt-2 text-brand-ink/60", compact ? "text-sm leading-6" : "text-base leading-7")}>
        Ideas para la vianda, tips simples y novedades de IQ Kids. Te podés dar de baja cuando quieras.
      </p>
    </div>
  );

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "rounded-[1.75rem] border border-brand-ink/10 bg-white",
        compact ? "p-6" : "grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-14",
        className,
      )}
    >
      {heading}

      {status === "done" ? (
        <div role="status" className={cn("flex items-start gap-3 rounded-2xl bg-green-50 p-5 text-sm leading-6 text-green-800", compact && "mt-5")}>
          <Check className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            <strong className="block">¡Listo, ya te sumamos!</strong>
            Vas a recibir la próxima edición en tu casilla.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className={cn(compact && "mt-5")} noValidate>
          <div className={cn("flex gap-3", compact ? "flex-col" : "flex-col sm:flex-row")}>
            <label className="min-w-0 flex-1">
              <span className="sr-only">Tu email</span>
              <Input type="email" inputMode="email" autoComplete="email" required placeholder="tu@email.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <Button type="submit" className={cn(!compact && "sm:w-auto", "shrink-0")} disabled={status === "sending" || !email || !consent}>
              {status === "sending" ? "Suscribiendo..." : "Suscribirme"}
            </Button>
          </div>
          {/* Honeypot: hidden from people, filled by bots. */}
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} className="hidden" aria-hidden />
          <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-brand-ink/65">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-brand-ink/20 accent-brand-pink" />
            <span>Acepto recibir la newsletter y novedades de IQ Kids por email.</span>
          </label>
          {error ? <p role="alert" className="mt-3 text-sm font-bold text-red-600">{error}</p> : null}
        </form>
      )}
    </section>
  );
}
