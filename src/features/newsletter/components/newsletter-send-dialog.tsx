"use client";

import { AlertTriangle, Send, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { argentinaLocalInputToIso, formatArgentinaLongDateTime, isoToArgentinaLocalInput } from "@/features/newsletter/components/newsletter-admin-labels";
import { SEND_CONFIRMATION_WORD } from "@/lib/validations/newsletter";
import { cn } from "@/lib/utils/cn";

export type SendDialogMode = "schedule" | "complementary" | "approve-review" | "resume" | "cancel-remaining" | "retry-errors" | "reconcile";

const copy: Record<SendDialogMode, { title: string; confirm: string; warning: string; withDate: boolean }> = {
  schedule: {
    title: "Programar envío",
    confirm: "Confirmar y programar",
    warning: "Una vez que empieza, el envío no se puede deshacer. Podés cancelarlo hasta la fecha elegida o pausarlo durante el envío.",
    withDate: true,
  },
  complementary: {
    title: "Enviar a nuevos suscriptos",
    confirm: "Confirmar envío",
    warning: "Solo la reciben quienes todavía no tienen esta newsletter. Nadie la recibe dos veces.",
    withDate: true,
  },
  "approve-review": {
    title: "Enviar igual",
    confirm: "Confirmar y enviar",
    warning: "El sistema frenó este envío por seguridad. Confirmá solo si revisaste el motivo.",
    withDate: false,
  },
  resume: {
    title: "Reanudar envío",
    confirm: "Reanudar",
    warning: "Los mails pendientes vuelven a salir en la próxima tanda.",
    withDate: false,
  },
  "cancel-remaining": {
    title: "Cancelar los envíos pendientes",
    confirm: "Cancelar pendientes",
    warning: "Los mails que todavía no salieron quedan como omitidos y no se envían. Los ya enviados no cambian.",
    withDate: false,
  },
  "retry-errors": {
    title: "Reintentar los envíos con error",
    confirm: "Reintentar",
    warning: "Los mails con error vuelven a la cola y salen en la próxima ejecución, una sola vez. Los que están \"a conciliar\" no se tocan, porque pueden haber llegado.",
    withDate: false,
  },
  reconcile: {
    title: "Confirmar acción",
    confirm: "Confirmar",
    warning: "Esta acción queda registrada en la auditoría.",
    withDate: false,
  },
};

export function NewsletterSendDialog({
  mode,
  recipients,
  subject,
  description,
  onClose,
  onConfirm,
}: {
  mode: SendDialogMode;
  recipients?: number | null;
  subject?: string;
  description?: string;
  onClose: () => void;
  onConfirm: (input: { scheduledAt?: string; sendNow?: boolean; confirmation: string }) => Promise<string | null>;
}) {
  const settings = copy[mode];
  const [when, setWhen] = useState<"now" | "later">("now");
  const [localDate, setLocalDate] = useState(() => isoToArgentinaLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !submitting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    let scheduledAt: string | undefined;
    if (settings.withDate && when === "later") {
      scheduledAt = argentinaLocalInputToIso(localDate) ?? undefined;
      if (!scheduledAt) {
        setError("Elegí una fecha y hora válidas.");
        return;
      }
    }

    setSubmitting(true);
    const failure = await onConfirm({ scheduledAt, sendNow: settings.withDate && when === "now" ? true : undefined, confirmation });
    setSubmitting(false);
    if (failure) setError(failure);
  }

  const confirmed = confirmation.trim() === SEND_CONFIRMATION_WORD;
  const laterIso = when === "later" ? argentinaLocalInputToIso(localDate) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-ink/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="send-dialog-title">
      <form onSubmit={submit} className="w-full max-w-lg rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-[2rem] sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <h2 id="send-dialog-title" className="font-display text-2xl text-brand-ink">
            {settings.title}
          </h2>
          <button type="button" onClick={onClose} disabled={submitting} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-brand-ink/50 hover:bg-brand-ink/5" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {typeof recipients === "number" ? (
          <div className="mt-5 rounded-[1.5rem] bg-brand-pinkSoft/30 p-5 text-center">
            <p className="text-4xl font-extrabold text-brand-ink">{recipients}</p>
            <p className="text-sm font-bold text-brand-ink/60">{recipients === 1 ? "destinataria/o" : "destinatarios"} ahora</p>
            <p className="mt-1 text-xs text-brand-ink/45">El número final se recalcula al confirmar. Nadie recibe esta newsletter dos veces.</p>
          </div>
        ) : null}

        {subject ? (
          <p className="mt-4 text-sm text-brand-ink/65">
            Asunto: <span className="font-bold text-brand-ink">{subject}</span>
          </p>
        ) : null}
        {description ? <p className="mt-3 text-sm leading-6 text-brand-ink/65">{description}</p> : null}

        {settings.withDate ? (
          <fieldset className="mt-5 space-y-3">
            <legend className="mb-2 text-sm font-bold">¿Cuándo?</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["now", "later"] as const).map((option) => (
                <label key={option} className={cn("flex cursor-pointer items-center justify-center rounded-2xl px-3 py-3 text-sm font-extrabold ring-1 transition", when === option ? "bg-brand-ink text-white ring-brand-ink" : "ring-brand-ink/15 hover:ring-brand-pink/40")}>
                  <input type="radio" name="when" value={option} checked={when === option} onChange={() => setWhen(option)} className="sr-only" />
                  {option === "now" ? "Enviar ahora" : "Programar"}
                </label>
              ))}
            </div>
            {when === "later" ? (
              <div className="space-y-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-brand-ink/60">Fecha y hora de Buenos Aires</span>
                  <Input type="datetime-local" value={localDate} onChange={(event) => setLocalDate(event.target.value)} required />
                </label>
                {laterIso ? (
                  <p className="rounded-2xl bg-brand-cyan/15 px-4 py-3 text-sm font-bold text-brand-ink">
                    Sale el {formatArgentinaLongDateTime(laterIso)} (hora de Buenos Aires), dentro de los 10 minutos siguientes.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs leading-5 text-brand-ink/50">Sale en la próxima ejecución automática, dentro de los próximos 10 minutos.</p>
            )}
          </fieldset>
        ) : null}

        <p className="mt-5 flex items-start gap-2 rounded-2xl bg-brand-yellow/20 p-4 text-sm leading-6 text-brand-ink/80">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /> {settings.warning}
        </p>

        <label className="mt-5 block">
          <span className="mb-2 block text-sm font-bold">
            Escribí <span className="rounded bg-brand-ink/8 px-1.5 py-0.5 font-mono">{SEND_CONFIRMATION_WORD}</span> para confirmar
          </span>
          <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} autoComplete="off" autoFocus />
        </label>

        {error ? <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Volver
          </Button>
          <Button type="submit" disabled={!confirmed || submitting}>
            <Send className="mr-2 h-4 w-4" />
            {submitting ? "Confirmando..." : settings.confirm}
          </Button>
        </div>
      </form>
    </div>
  );
}
