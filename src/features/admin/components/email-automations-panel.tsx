"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { EmailAutomationTrigger, EmailSendStatus } from "@prisma/client";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCouponDiscountLabel } from "@/features/coupons/lib/coupon-pricing";
import { formatArs } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

type AutomationItem = {
  id: string;
  name: string;
  trigger: EmailAutomationTrigger;
  active: boolean;
  delayHours: number;
  subject: string;
  previewText: string | null;
  bodyText: string;
  ctaLabel: string | null;
  ctaUrlTemplate: string | null;
  senderName: string;
  fromEmail: string;
  replyToEmail: string | null;
  bccEmail: string | null;
  couponId: string | null;
  couponHeadline: string | null;
  couponMessage: string | null;
  coupon: {
    id: string;
    code: string;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    discountPercentage: unknown;
    fixedDiscountArs: number | null;
    description: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { logs: number };
};

type LogItem = {
  id: string;
  trigger: EmailAutomationTrigger;
  status: EmailSendStatus;
  recipientEmail: string;
  subject: string;
  targetType: string;
  targetId: string;
  errorMessage: string | null;
  openCount: number;
  firstOpenedAt: Date | null;
  lastOpenedAt: Date | null;
  clickCount: number;
  firstClickedAt: Date | null;
  lastClickedAt: Date | null;
  convertedOrderNumber: string | null;
  convertedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  automation: { name: string };
  convertedOrder: {
    publicOrderNumber: string;
    totalArs: number;
    paymentStatus: string;
    createdAt: Date;
  } | null;
  order: {
    publicOrderNumber: string;
    createdAt: Date;
    paidAt: Date | null;
    paymentStatus: string;
    totalArs: number;
    customerEmail: string;
    paymentProofs: Array<{ uploadedAt: Date }>;
  } | null;
  cartRecoveryLead: {
    email: string;
    status: string;
    subtotalArs: number;
    createdAt: Date;
    checkoutStartedAt: Date | null;
    convertedAt: Date | null;
    convertedOrderNumber: string | null;
  } | null;
};

type CartLeadItem = {
  id: string;
  email: string;
  trigger: EmailAutomationTrigger;
  status: string;
  subtotalArs: number;
  triggerAt: Date;
  latestLog: {
    id: string;
    status: EmailSendStatus;
    sentAt: Date | null;
    createdAt: Date;
    errorMessage: string | null;
    automationName: string;
  } | null;
};

type RecoveryLeadTiming = {
  scheduledAt: Date | null;
  isReady: boolean;
  isOverdue: boolean;
};

type EmailAutomationsPanelProps = {
  automations: AutomationItem[];
  recentLogs: LogItem[];
  cartLeads: CartLeadItem[];
  coupons: Array<{
    id: string;
    code: string;
    discountType: "PERCENTAGE" | "FIXED_AMOUNT";
    discountPercentage: unknown;
    fixedDiscountArs: number | null;
    description: string | null;
  }>;
  trackingSummary: {
    sent: number;
    opened: number;
    clicked: number;
    converted: number;
  };
  newsletterSubscribers: number;
  emailEnabled: boolean;
};

type FormState = {
  id: string | null;
  name: string;
  trigger: EmailAutomationTrigger;
  active: boolean;
  delayHours: number;
  subject: string;
  previewText: string;
  bodyText: string;
  ctaLabel: string;
  ctaUrlTemplate: string;
  senderName: string;
  fromEmail: string;
  replyToEmail: string;
  bccEmail: string;
  couponId: string;
  couponHeadline: string;
  couponMessage: string;
};

const defaultForm: FormState = {
  id: null,
  name: "",
  trigger: "CART_ABANDONED",
  active: false,
  delayHours: 3,
  subject: "",
  previewText: "",
  bodyText: "",
  ctaLabel: "",
  ctaUrlTemplate: "",
  senderName: "IQ Kids",
  fromEmail: "no-reply@iqkids.com.ar",
  replyToEmail: "",
  bccEmail: "",
  couponId: "",
  couponHeadline: "",
  couponMessage: "",
};

const triggerLabels: Record<EmailAutomationTrigger, string> = {
  WELCOME_LEAD: "Bienvenida temprana",
  CART_ABANDONED: "Recuperacion sin compra",
  ORDER_CREATED: "Pedido recibido",
  POST_PURCHASE: "Post compra",
};

const triggerShortHelp: Record<EmailAutomationTrigger, string> = {
  WELCOME_LEAD: "Contacta el email captado en home antes de que exista un carrito.",
  CART_ABANDONED: "Recupera emails que quedaron sin pago ni comprobante.",
  ORDER_CREATED: "Confirma que el pedido entro correctamente.",
  POST_PURCHASE: "Vuelve a contactar despues de una compra confirmada.",
};

const triggerOperationalSummary: Record<EmailAutomationTrigger, string> = {
  WELCOME_LEAD:
    "Empieza cuando una persona deja su email en el popup del home. Sirve para un primer contacto o un recordatorio temprano antes de que exista carrito. Si esa persona ya termino comprando despues de ese alta, el envio se omite.",
  CART_ABANDONED:
    "Empieza cuando una persona deja email en carrito. Si avanza a checkout o genera pedido pero no paga ni sube comprobante, sigue entrando en esta recuperacion. Espera la demora configurada y antes de enviar revisa si ese email tuvo una compra confirmada posterior; si compro, lo omite.",
  ORDER_CREATED:
    "Empieza cuando se genera el pedido al finalizar el checkout. Sirve para confirmar recepcion del pedido, aunque el pago todavia pueda estar pendiente.",
  POST_PURCHASE:
    "Empieza solo cuando hay compra real: pago aprobado por Mercado Pago o comprobante de transferencia subido. La demora corre desde ese momento.",
};


const triggerTimingLabel: Record<EmailAutomationTrigger, string> = {
  WELCOME_LEAD: "despues de captar email",
  CART_ABANDONED: "despues de quedar sin compra",
  ORDER_CREATED: "despues de crear pedido",
  POST_PURCHASE: "despues de comprar",
};

const statusLabels: Record<EmailSendStatus, string> = {
  SENT: "Enviado",
  SKIPPED: "Omitido",
  ERROR: "Error",
};

const variablesByTrigger: Record<EmailAutomationTrigger, string[]> = {
  WELCOME_LEAD: ["{{siteUrl}}", "{{email}}"],
  CART_ABANDONED: ["{{recoveryUrl}}", "{{subtotal}}", "{{siteUrl}}", "{{email}}"],
  ORDER_CREATED: ["{{firstName}}", "{{orderNumber}}", "{{orderUrl}}", "{{total}}", "{{siteUrl}}"],
  POST_PURCHASE: ["{{firstName}}", "{{orderNumber}}", "{{orderUrl}}", "{{total}}", "{{siteUrl}}"],
};

const variableDescriptions: Partial<Record<EmailAutomationTrigger, Record<string, string>>> = {
  CART_ABANDONED: {
    "{{recoveryUrl}}": "URL unica que reconstruye el carrito de cada cliente.",
    "{{subtotal}}": "Subtotal del carrito guardado.",
    "{{siteUrl}}": "URL principal de la tienda.",
    "{{email}}": "Email que dejo la persona en el carrito.",
  },
  ORDER_CREATED: {
    "{{firstName}}": "Nombre cargado por el cliente en checkout.",
    "{{orderUrl}}": "URL de confirmacion del pedido.",
    "{{orderNumber}}": "Numero publico del pedido.",
    "{{total}}": "Total del pedido, incluyendo envio y descuentos.",
    "{{siteUrl}}": "URL principal de la tienda.",
  },
  POST_PURCHASE: {
    "{{firstName}}": "Nombre del cliente que compro.",
    "{{orderNumber}}": "Numero publico del pedido.",
    "{{orderUrl}}": "URL de confirmacion del pedido.",
    "{{total}}": "Total pagado por el cliente.",
    "{{siteUrl}}": "URL principal de la tienda.",
  },
};

export function EmailAutomationsPanel({ automations, recentLogs, cartLeads, coupons, trackingSummary, newsletterSubscribers, emailEnabled }: EmailAutomationsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(automations[0]?.id ?? null);
  const [form, setForm] = useState<FormState>(() => automationToForm(automations[0] ?? null));
  const [testEmail, setTestEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedAutomation = useMemo(
    () => automations.find((automation) => automation.id === selectedId) ?? null,
    [automations, selectedId],
  );

  useEffect(() => {
    setForm(automationToForm(selectedAutomation));
    setMessage(null);
    setError(null);
  }, [selectedAutomation]);

  const activeCount = automations.filter((automation) => automation.active).length;
  const sentCount = recentLogs.filter((log) => log.status === "SENT").length;
  const latestLogByCase = useMemo(() => {
    const latest = new Map<string, LogItem>();

    for (const log of recentLogs) {
      const caseKey = getAutomationCaseKey(log);

      if (!latest.has(caseKey)) {
        latest.set(caseKey, log);
      }
    }

    return latest;
  }, [recentLogs]);
  const errorCount = useMemo(
    () => Array.from(latestLogByCase.values()).filter((log) => log.status === "ERROR").length,
    [latestLogByCase],
  );
  const activeWelcomeDelayHours = useMemo(() => {
    const welcomeAutomations = automations
      .filter((automation) => automation.active && automation.trigger === "WELCOME_LEAD")
      .map((automation) => automation.delayHours);

    if (!welcomeAutomations.length) {
      return null;
    }

    return Math.min(...welcomeAutomations);
  }, [automations]);

  const activeRecoveryDelayHours = useMemo(() => {
    const recoveryAutomations = automations
      .filter((automation) => automation.active && automation.trigger === "CART_ABANDONED")
      .map((automation) => automation.delayHours);

    if (!recoveryAutomations.length) {
      return null;
    }

    return Math.min(...recoveryAutomations);
  }, [automations]);

  const startNewAutomation = () => {
    setSelectedId(null);
    setForm(defaultForm);
    setMessage(null);
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    const response = await fetch(form.id ? `/api/admin/email-automations/${form.id}` : "/api/admin/email-automations", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = (await response.json()) as { error?: string };
    setIsSaving(false);

    if (!response.ok) {
      setError(payload.error ?? "No se pudo guardar la automatizacion.");
      return;
    }

    setMessage(form.id ? "Automatizacion actualizada." : "Automatizacion creada.");
    window.setTimeout(() => window.location.reload(), 900);
  };

  const deleteAutomation = async () => {
    if (!form.id || !window.confirm("Eliminar esta automatizacion?")) {
      return;
    }

    const response = await fetch(`/api/admin/email-automations/${form.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("No se pudo eliminar la automatizacion.");
      return;
    }
    window.location.reload();
  };

  const processAutomation = async (automationId?: string) => {
    setIsProcessing(automationId ?? "all");
    setMessage(null);
    setError(null);
    const response = await fetch("/api/admin/email-automations/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(automationId ? { automationId } : {}),
    });
    const payload = (await response.json()) as { error?: string; data?: { results?: Array<{ sent: number; skipped: number; errors: number }> } };
    setIsProcessing(null);

    if (!response.ok) {
      setError(payload.error ?? "No se pudo procesar la cola.");
      return;
    }

    const totals = (payload.data?.results ?? []).reduce(
      (acc, item) => ({ sent: acc.sent + item.sent, skipped: acc.skipped + item.skipped, errors: acc.errors + item.errors }),
      { sent: 0, skipped: 0, errors: 0 },
    );

    const waitingCartRecoveries =
      selectedAutomation?.trigger === "CART_ABANDONED" && activeRecoveryDelayHours !== null
        ? cartLeads
            .filter((lead) => {
              if (lead.trigger !== "CART_ABANDONED" || lead.latestLog) return false;
              const scheduledAt = new Date(lead.triggerAt).getTime() + activeRecoveryDelayHours * 60 * 60 * 1000;
              return scheduledAt > Date.now();
            })
            .map((lead) => new Date(new Date(lead.triggerAt).getTime() + activeRecoveryDelayHours * 60 * 60 * 1000))
            .sort((left, right) => left.getTime() - right.getTime())
        : [];

    if (totals.sent === 0 && totals.skipped === 0 && totals.errors === 0 && waitingCartRecoveries.length) {
      const nextScheduledAt = waitingCartRecoveries[0];
      setMessage(
        `Todavía no hay emails listos: ${waitingCartRecoveries.length} carrito(s) siguen en espera. El próximo queda listo ${formatArgentinaDateTime(nextScheduledAt)}.`,
      );
      return;
    }

    setMessage(`Proceso listo: ${totals.sent} enviados, ${totals.skipped} omitidos, ${totals.errors} errores.`);
  };

  const sendTest = async () => {
    if (!form.id) {
      setError("Primero guarda la automatizacion para poder enviar una prueba.");
      return;
    }

    if (!emailEnabled) {
      setError("Para enviar pruebas tenes que habilitar EMAIL_SENDING_ENABLED y configurar Resend o SMTP.");
      return;
    }

    setIsTesting(true);
    setMessage(null);
    setError(null);
    const response = await fetch("/api/admin/email-automations/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ automationId: form.id, to: testEmail }),
    });
    const payload = (await response.json()) as {
      error?: string;
      data?: {
        providerMessageId?: string | null;
        recoveryUrl?: string | null;
      };
    };
    setIsTesting(false);

    if (!response.ok) {
      setError(payload.error ?? "No se pudo enviar la prueba.");
      return;
    }

    setMessage(
      [
        `Prueba enviada a ${testEmail}.`,
        payload.data?.providerMessageId ? `ID proveedor: ${payload.data.providerMessageId}.` : null,
        payload.data?.recoveryUrl ? `CTA: ${payload.data.recoveryUrl}` : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">CRM</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Emails automaticos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/65">
            Automatizaciones simples: elegi el evento, escribi el mensaje, probalo y activalo cuando este listo.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/api/admin/export/email-leads"
            className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 transition hover:bg-brand-peach"
          >
            Descargar mails CRM
          </Link>
          <Link
            href="/api/admin/export/newsletter-subscribers"
            className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 transition hover:bg-brand-peach"
          >
            Descargar suscriptos
          </Link>
          <Button type="button" variant="secondary" onClick={startNewAutomation}>
            Nueva automatizacion
          </Button>
          <Button type="button" onClick={() => processAutomation()} disabled={isProcessing !== null || !emailEnabled}>
            {isProcessing === "all" ? "Procesando..." : "Procesar activos"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric label="Activas" value={activeCount.toString()} />
        <Metric label="Newsletter" value={newsletterSubscribers.toString()} />
        <Metric label="Sin compra" value={cartLeads.length.toString()} />
        <Metric label="Enviados recientes" value={sentCount.toString()} />
        <Metric label="Aperturas detectadas" value={trackingSummary.opened.toString()} />
        <Metric label="Clicks recientes" value={trackingSummary.clicked.toString()} />
        <Metric label="Ventas atribuidas" value={trackingSummary.converted.toString()} />
      </div>
      {errorCount ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          Hay {errorCount} errores vigentes de email. Revisalos en auditoria.
        </p>
      ) : null}

      <div
        className={cn(
          "rounded-3xl border px-5 py-4 text-sm font-bold",
          emailEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800",
        )}
      >
        {emailEnabled
          ? "Envios habilitados. Podes enviar pruebas y procesar automatizaciones."
          : "Envios pausados. Configura EMAIL_SENDING_ENABLED=true y un proveedor de emails (Resend o SMTP) para enviar emails reales."}
      </div>

      {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}

      <Card className="p-5 md:p-6">
        <div className="mb-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-pink">Como dispara cada mail</p>
          <h2 className="mt-1 font-display text-2xl text-brand-ink">Reglas claras para vender sin ruido</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {Object.entries(triggerOperationalSummary).map(([trigger, summary]) => (
            <div key={trigger} className="rounded-3xl border border-brand-ink/10 bg-background/70 p-4">
              <p className="text-sm font-extrabold text-brand-ink">{triggerLabels[trigger as EmailAutomationTrigger]}</p>
              <p className="mt-2 text-sm leading-6 text-brand-ink/60">{summary}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="p-4 md:p-5">
          <div className="mb-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-pink">Automatizaciones</p>
            <p className="mt-1 text-sm text-brand-ink/55">Selecciona una para editar.</p>
          </div>
          <div className="space-y-3">
            {automations.map((automation) => (
              <button
                key={automation.id}
                type="button"
                onClick={() => setSelectedId(automation.id)}
                className={cn(
                  "w-full rounded-3xl border p-4 text-left transition hover:border-brand-pink/40 hover:bg-brand-pinkSoft/25",
                  selectedId === automation.id ? "border-brand-pink bg-brand-pinkSoft/35" : "border-brand-ink/10 bg-white",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-brand-ink">{automation.name}</p>
                    <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.12em] text-brand-ink/45">
                      {triggerLabels[automation.trigger]}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.12em]",
                      automation.active ? "bg-emerald-50 text-emerald-700" : "bg-brand-ink/5 text-brand-ink/45",
                    )}
                  >
                    {automation.active ? "Activa" : "Pausada"}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-brand-ink/65">{automation.subject}</p>
                <div className="mt-3 flex items-center justify-between text-xs font-bold text-brand-ink/45">
                  <span>{automation.delayHours} hs {triggerTimingLabel[automation.trigger]}</span>
                  <span>{automation._count.logs} logs</span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5 md:p-6">
            <form className="space-y-5" onSubmit={submit}>
              <div className="grid gap-4 lg:grid-cols-[1fr_220px] lg:items-start">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-pink">
                    {form.id ? "Editor" : "Nueva automatizacion"}
                  </p>
                  <h2 className="mt-2 font-display text-2xl text-brand-ink md:text-3xl">
                    {form.name || triggerLabels[form.trigger]}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-brand-ink/60">{triggerShortHelp[form.trigger]}</p>
                </div>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-brand-ink/10 bg-background px-4 py-3 text-sm font-bold text-brand-ink">
                  Activa
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                    className="h-5 w-5 accent-brand-pink"
                  />
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Field label="Nombre interno">
                  <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                </Field>
                <Field label="Disparador">
                  <select
                    value={form.trigger}
                    onChange={(event) => setForm((current) => ({ ...current, trigger: event.target.value as EmailAutomationTrigger }))}
                    className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
                  >
                    {Object.entries(triggerLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Demora">
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={8760}
                      value={form.delayHours}
                      onChange={(event) => setForm((current) => ({ ...current, delayHours: Number(event.target.value) }))}
                      required
                    />
                    <span className="text-sm font-bold text-brand-ink/55">hs</span>
                  </div>
                </Field>
              </div>

              <div className="rounded-3xl border border-brand-ink/10 bg-background/70 p-4 md:p-5">
                <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">Contenido</p>
                <div className="space-y-4">
                  <Field label="Asunto">
                    <Input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} required />
                  </Field>
                  <Field label="Texto corto de bandeja">
                    <Input value={form.previewText} onChange={(event) => setForm((current) => ({ ...current, previewText: event.target.value }))} />
                  </Field>
                  <Field label="Mensaje">
                    <Textarea
                      value={form.bodyText}
                      onChange={(event) => setForm((current) => ({ ...current, bodyText: event.target.value }))}
                      rows={7}
                      required
                    />
                  </Field>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                <div className="rounded-3xl border border-brand-ink/10 bg-white p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">Variables</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {variablesByTrigger[form.trigger].map((variable) => {
                      const description =
                        variableDescriptions[form.trigger]?.[variable] ?? "Variable disponible para este disparador.";

                      return (
                        <span key={variable} className="group relative inline-flex">
                          <button
                            type="button"
                            title={description}
                            aria-label={`${variable}: ${description}`}
                            onClick={() => navigator.clipboard?.writeText(variable)}
                            className="rounded-full bg-brand-pinkSoft px-3 py-1 text-xs font-extrabold text-brand-ink transition hover:bg-brand-pink hover:text-white focus-visible:bg-brand-pink focus-visible:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/30"
                          >
                            {variable}
                          </button>
                          <span className="pointer-events-none absolute left-0 top-[calc(100%+0.5rem)] z-20 hidden w-64 rounded-2xl border border-brand-ink/10 bg-white p-3 text-xs font-semibold leading-5 text-brand-ink/70 shadow-card group-hover:block group-focus-within:block">
                            {description}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-3 space-y-1 text-xs leading-5 text-brand-ink/55">
                    <p>Toca una variable para copiarla. Pasa el mouse o enfoca cada chip para ver que dato inserta.</p>
                    {Object.entries(variableDescriptions[form.trigger] ?? {}).map(([variable, description]) => (
                      <p key={variable}>
                        <span className="font-extrabold text-brand-ink">{variable}</span>: {description}
                      </p>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-brand-ink/10 bg-white p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">CTA</p>
                      <p className="mt-1 text-xs leading-5 text-brand-ink/50">
                        El boton puede usar una URL fija o una variable dinamica.
                      </p>
                    </div>
                    {form.trigger === "CART_ABANDONED" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            ctaLabel: current.ctaLabel || "Volver al carrito",
                            ctaUrlTemplate: "{{recoveryUrl}}",
                          }))
                        }
                        className="rounded-full bg-brand-pinkSoft px-3 py-2 text-xs font-extrabold text-brand-ink transition hover:bg-brand-pink/20"
                      >
                        Usar carrito dinamico
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="Texto del boton"
                      value={form.ctaLabel}
                      onChange={(event) => setForm((current) => ({ ...current, ctaLabel: event.target.value }))}
                    />
                    <Input
                      placeholder="URL o variable"
                      value={form.ctaUrlTemplate}
                      onChange={(event) => setForm((current) => ({ ...current, ctaUrlTemplate: event.target.value }))}
                    />
                  </div>
                  {form.trigger === "CART_ABANDONED" ? (
                    <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold leading-5 text-emerald-800">
                      Para recuperar cada carrito, la URL del CTA debe ser <span className="font-extrabold">{"{{recoveryUrl}}"}</span>.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl border border-brand-ink/10 bg-white p-4 md:p-5">
                <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-pink">Cupón opcional</p>
                    <p className="mt-2 text-sm leading-6 text-brand-ink/55">
                      Si elegís uno, aparece como bloque destacado dentro del mail.
                    </p>
                  </div>
                  <div className="grid gap-4">
                    <Field label="Cupón">
                      <select
                        value={form.couponId}
                        onChange={(event) => setForm((current) => ({ ...current, couponId: event.target.value }))}
                        className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
                      >
                        <option value="">Sin cupón</option>
                        {coupons.map((coupon) => (
                          <option key={coupon.id} value={coupon.id}>
                            {coupon.code} -{" "}
                            {getCouponDiscountLabel({
                              discountType: coupon.discountType,
                              discountPercentage:
                                coupon.discountPercentage == null ? null : Number(coupon.discountPercentage),
                              fixedDiscountArs: coupon.fixedDiscountArs,
                            })}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {form.couponId ? (
                      <div className="grid gap-4 lg:grid-cols-2">
                        <Field label="Título del regalo">
                          <Input
                            placeholder="Un mimo para volver a resolver la semana"
                            value={form.couponHeadline}
                            onChange={(event) => setForm((current) => ({ ...current, couponHeadline: event.target.value }))}
                          />
                        </Field>
                        <Field label="Mensaje del cupón">
                          <Input
                            placeholder="Usalo en tu compra antes de finalizar."
                            value={form.couponMessage}
                            onChange={(event) => setForm((current) => ({ ...current, couponMessage: event.target.value }))}
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <details className="rounded-3xl border border-brand-ink/10 bg-white p-4">
                <summary className="cursor-pointer text-sm font-extrabold uppercase tracking-[0.14em] text-brand-ink/55">
                  Remitente avanzado
                </summary>
                <div className="mt-4 grid gap-4 lg:grid-cols-4">
                  <Field label="Nombre remitente">
                    <Input value={form.senderName} onChange={(event) => setForm((current) => ({ ...current, senderName: event.target.value }))} required />
                  </Field>
                  <Field label="From">
                    <Input
                      type="email"
                      value={form.fromEmail}
                      onChange={(event) => setForm((current) => ({ ...current, fromEmail: event.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Reply-to">
                    <Input
                      type="email"
                      value={form.replyToEmail}
                      onChange={(event) => setForm((current) => ({ ...current, replyToEmail: event.target.value }))}
                    />
                  </Field>
                  <Field label="Copia oculta">
                    <Input
                      type="email"
                      placeholder="control@empresa.com"
                      value={form.bccEmail}
                      onChange={(event) => setForm((current) => ({ ...current, bccEmail: event.target.value }))}
                    />
                  </Field>
                </div>
              </details>

              <div className="flex flex-col gap-3 border-t border-brand-ink/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Guardando..." : "Guardar"}
                  </Button>
                  {form.id ? (
                    <Button type="button" variant="secondary" onClick={() => processAutomation(form.id!)} disabled={isProcessing !== null || !form.active || !emailEnabled}>
                      {isProcessing === form.id ? "Procesando..." : "Procesar esta"}
                    </Button>
                  ) : null}
                </div>
                {form.id ? (
                  <Button type="button" variant="ghost" onClick={deleteAutomation}>
                    Eliminar
                  </Button>
                ) : null}
              </div>
            </form>
          </Card>

          <Card className="p-5 md:p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr_auto] lg:items-end">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-pink">Prueba manual</p>
                <h3 className="mt-1 font-display text-2xl text-brand-ink">Ver como llega</h3>
                <p className="mt-1 text-sm text-brand-ink/55">
                  Usa datos de ejemplo, salvo recuperacion sin compra: ahi usa el ultimo carrito real abierto. No registra log de campana.
                </p>
                {!emailEnabled ? (
                  <p className="mt-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-800">
                    Envio deshabilitado: falta configurar proveedor de emails.
                  </p>
                ) : null}
                {!form.id ? (
                  <p className="mt-2 rounded-2xl bg-brand-pinkSoft px-3 py-2 text-xs font-bold leading-5 text-brand-ink">
                    Guarda la automatizacion antes de enviar una prueba.
                  </p>
                ) : null}
              </div>
              <Field label="Enviar prueba a">
                <Input
                  type="email"
                  placeholder="tu.nombre@empresa.com"
                  value={testEmail}
                  onChange={(event) => setTestEmail(event.target.value)}
                />
              </Field>
              <Button type="button" onClick={sendTest} disabled={isTesting || !form.id || !testEmail}>
                {isTesting ? "Enviando..." : "Enviar prueba"}
              </Button>
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5 md:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">Capturas y recuperaciones</p>
                  <p className="mt-1 text-sm leading-6 text-brand-ink/55">
                    El popup se registra al instante; los carritos muestran cuando se enviara la recuperacion segun la demora activa.
                  </p>
                </div>
                {activeWelcomeDelayHours !== null || activeRecoveryDelayHours !== null ? (
                  <div className="rounded-2xl bg-background px-3 py-2 text-right text-xs leading-5 text-brand-ink/60">
                    <p className="font-extrabold uppercase tracking-[0.12em] text-brand-ink/45">Recuperacion activa</p>
                    <p className="font-bold text-brand-ink">{activeRecoveryDelayHours} hs de demora</p>
                    <p>Si un caso ya quedo listo y no sale, revisar cron/proceso.</p>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-amber-50 px-3 py-2 text-right text-xs font-bold leading-5 text-amber-800">
                    No hay automatizaciones activas para leads sin compra.
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-3">
                {cartLeads.length ? (
                  cartLeads.slice(0, 8).map((lead) => {
                    const delayHours = lead.trigger === "WELCOME_LEAD" ? activeWelcomeDelayHours : activeRecoveryDelayHours;
                    const timing = getRecoveryLeadTiming(lead.triggerAt, delayHours, lead.latestLog, lead.trigger);

                    return (
                      <div key={lead.id} className="rounded-2xl bg-background px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-brand-ink">{lead.email}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand-ink/45">{triggerLabels[lead.trigger]} · {lead.status}</p>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em]",
                                  timing.visualState === "sent"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : timing.visualState === "error"
                                      ? "bg-red-50 text-red-700"
                                      : timing.visualState === "overdue"
                                        ? "bg-red-50 text-red-700"
                                        : timing.visualState === "ready"
                                          ? "bg-emerald-50 text-emerald-700"
                                          : "bg-amber-50 text-amber-700",
                                )}
                              >
                                {timing.label}
                              </span>
                            </div>
                          </div>
                          <p className="shrink-0 text-sm font-bold text-brand-ink">{formatArs(lead.subtotalArs)}</p>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-brand-ink/55 sm:grid-cols-2">
                          <div>
                            <p className="font-extrabold uppercase tracking-[0.12em] text-brand-ink/40">Inicio</p>
                            <p className="mt-1 font-semibold text-brand-ink/70">{formatArgentinaDateTime(new Date(lead.triggerAt))}</p>
                          </div>
                          <div>
                            <p className="font-extrabold uppercase tracking-[0.12em] text-brand-ink/40">Programado</p>
                            <p className="mt-1 font-semibold text-brand-ink/70">
                              {timing.scheduledAt
                                ? formatArgentinaDateTime(timing.scheduledAt)
                                : lead.trigger === "WELCOME_LEAD"
                                  ? "No aplica: email inmediato del popup"
                                  : "Sin automatización activa"}
                            </p>
                          </div>
                        </div>
                        {lead.latestLog ? (
                          <div
                            className={cn(
                              "mt-3 rounded-2xl px-3 py-2 text-xs font-bold leading-5",
                              lead.latestLog.status === "ERROR"
                                ? "bg-red-50 text-red-700"
                                : "bg-emerald-50 text-emerald-800",
                            )}
                          >
                            <p>
                              {lead.latestLog.status === "ERROR" ? "Ultimo intento con error" : "Ultimo envio registrado"} ·{" "}
                              {formatArgentinaDateTime(new Date(lead.latestLog.sentAt ?? lead.latestLog.createdAt))}
                            </p>
                            <p className="mt-1">{lead.latestLog.automationName}</p>
                            {lead.latestLog.errorMessage ? <p className="mt-1">{lead.latestLog.errorMessage}</p> : null}
                          </div>
                        ) : null}
                        {!lead.latestLog && timing.isOverdue ? (
                          <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">
                            Ya supero la demora configurada. Si sigue aca, probablemente falte ejecutar el cron o el proceso manual.
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-brand-ink/55">No hay leads sin compra pendientes de seguimiento.</p>
                )}
              </div>
            </Card>

            <Card className="p-5 md:p-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">Estado de envios</p>
              <div className="mt-4 space-y-3">
                <MetricLine label="Enviados" value={sentCount.toString()} />
                <MetricLine label="Aperturas detectadas" value={trackingSummary.opened.toString()} />
                <MetricLine label="Clics" value={trackingSummary.clicked.toString()} />
                <MetricLine label="Ventas atribuidas" value={trackingSummary.converted.toString()} />
                <MetricLine label="Omitidos" value={recentLogs.filter((log) => log.status === "SKIPPED").length.toString()} />
                <MetricLine label="Errores" value={errorCount.toString()} />
              </div>
            </Card>
          </div>

          <Card className="p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-pink">Auditoria</p>
                <h3 className="mt-1 font-display text-2xl text-brand-ink">Historial completo</h3>
                <p className="mt-1 text-sm leading-6 text-brand-ink/55">
                  Revisa enviados, omitidos y errores en una subseccion con filtros por fecha.
                </p>
              </div>
              <Link
                href="/admin/emails/auditoria"
                className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 transition hover:bg-brand-peach"
              >
                Ver auditoria
              </Link>
            </div>

            <div className="hidden">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-ink/10 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink/45">
                    <th className="py-3 pr-4">Estado</th>
                    <th className="py-3 pr-4">Mail</th>
                    <th className="py-3 pr-4">Automatizacion</th>
                    <th className="py-3 pr-4">Disparador</th>
                    <th className="py-3 pr-4">Fecha envio/log</th>
                    <th className="py-3 pr-4">Fecha inicio</th>
                    <th className="py-3 pr-4">Objetivo</th>
                    <th className="py-3 pr-4">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.length ? (
                    recentLogs.map((log) => (
                      <tr key={log.id} className="border-b border-brand-ink/8 align-top">
                        <td className="py-3 pr-4">
                          <StatusBadge status={log.status} />
                        </td>
                        <td className="py-3 pr-4 font-bold text-brand-ink">{log.recipientEmail}</td>
                        <td className="py-3 pr-4 text-brand-ink/70">{log.automation.name}</td>
                        <td className="py-3 pr-4 text-brand-ink/70">{triggerLabels[log.trigger]}</td>
                        <td className="py-3 pr-4 text-brand-ink/70">{formatArgentinaDateTime(new Date(log.sentAt ?? log.createdAt))}</td>
                        <td className="py-3 pr-4 text-brand-ink/70">{getLogStartDate(log)}</td>
                        <td className="py-3 pr-4 text-brand-ink/70">{getLogTargetLabel(log)}</td>
                        <td className="py-3 pr-4 text-brand-ink/60">
                          <p className="max-w-[280px] font-bold text-brand-ink">{log.subject}</p>
                          {log.errorMessage ? <p className="mt-1 max-w-[280px] text-xs font-bold text-red-700">{log.errorMessage}</p> : null}
                          {log.cartRecoveryLead ? (
                            <p className="mt-1 text-xs">
                              Carrito {formatArs(log.cartRecoveryLead.subtotalArs)} · {log.cartRecoveryLead.status}
                            </p>
                          ) : null}
                          {log.order ? <p className="mt-1 text-xs">Pedido {formatArs(log.order.totalArs)} · {log.order.paymentStatus}</p> : null}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-brand-ink/55">
                        No hay emails para el filtro seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function automationToForm(automation: AutomationItem | null): FormState {
  if (!automation) {
    return defaultForm;
  }

  return {
    id: automation.id,
    name: automation.name,
    trigger: automation.trigger,
    active: automation.active,
    delayHours: automation.delayHours,
    subject: automation.subject,
    previewText: automation.previewText ?? "",
    bodyText: automation.bodyText,
    ctaLabel: automation.ctaLabel ?? "",
    ctaUrlTemplate: automation.ctaUrlTemplate ?? "",
    senderName: automation.senderName,
    fromEmail: automation.fromEmail,
    replyToEmail: automation.replyToEmail ?? "",
    bccEmail: automation.bccEmail ?? "",
    couponId: automation.couponId ?? "",
    couponHeadline: automation.couponHeadline ?? "",
    couponMessage: automation.couponMessage ?? "",
  };
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/45">{label}</p>
      <p className={cn("mt-3 font-display text-3xl", tone === "danger" ? "text-red-600" : "text-brand-ink")}>{value}</p>
    </Card>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
      <span className="text-sm font-bold text-brand-ink/60">{label}</span>
      <span className="font-display text-2xl text-brand-ink">{value}</span>
    </div>
  );
}

function getLogStartDate(log: LogItem) {
  const start =
    log.trigger === "CART_ABANDONED"
      ? log.cartRecoveryLead?.createdAt
      : log.trigger === "POST_PURCHASE"
        ? log.order?.paidAt ?? log.order?.paymentProofs[0]?.uploadedAt ?? log.order?.createdAt
        : log.order?.createdAt;

  return start ? formatArgentinaDateTime(new Date(start)) : "-";
}

function getLogTargetLabel(log: LogItem) {
  if (log.cartRecoveryLead) {
    return log.cartRecoveryLead.convertedOrderNumber
      ? `Carrito -> pedido ${log.cartRecoveryLead.convertedOrderNumber}`
      : `Carrito ${log.cartRecoveryLead.status}`;
  }

  if (log.order) {
    return `Pedido ${log.order.publicOrderNumber}`;
  }

  return log.targetType;
}

function getRecoveryLeadTiming(
  triggerAt: Date,
  delayHours: number | null,
  latestLog: CartLeadItem["latestLog"],
  trigger: EmailAutomationTrigger,
): RecoveryLeadTiming & { label: string; visualState: "waiting" | "ready" | "overdue" | "sent" | "error" } {
  if (latestLog?.status === "SENT") {
    return {
      scheduledAt: delayHours === null ? null : new Date(triggerAt.getTime() + delayHours * 60 * 60 * 1000),
      isReady: true,
      isOverdue: false,
      label: "Enviado",
      visualState: "sent",
    };
  }

  if (latestLog?.status === "ERROR") {
    return {
      scheduledAt: delayHours === null ? null : new Date(triggerAt.getTime() + delayHours * 60 * 60 * 1000),
      isReady: true,
      isOverdue: true,
      label: "Error de envio",
      visualState: "error",
    };
  }

  if (delayHours === null) {
    return {
      scheduledAt: null,
      isReady: false,
      isOverdue: false,
      label: trigger === "WELCOME_LEAD" ? "Capturado en popup" : "Sin automatización",
      visualState: "waiting",
    };
  }

  const scheduledAt = new Date(triggerAt.getTime() + delayHours * 60 * 60 * 1000);
  const now = Date.now();
  const isReady = now >= scheduledAt.getTime();
  const isOverdue = now >= scheduledAt.getTime() + 15 * 60 * 1000;

  return {
    scheduledAt,
    isReady,
    isOverdue,
    label: isReady ? (isOverdue ? "Listo y pendiente" : "Listo para enviar") : "En espera",
    visualState: isReady ? (isOverdue ? "overdue" : "ready") : "waiting",
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-brand-ink">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: EmailSendStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.12em]",
        status === "SENT" ? "bg-emerald-50 text-emerald-700" : status === "ERROR" ? "bg-red-50 text-red-700" : "bg-brand-ink/5 text-brand-ink/50",
      )}
    >
      {statusLabels[status]}
    </span>
  );
}

function getAutomationCaseKey(log: LogItem) {
  if (log.targetType === "cart_recovery_lead") {
    return `${log.targetType}:${normalizeAutomationTargetId(log.targetId)}`;
  }

  return `${log.targetType}:${log.targetId}`;
}

function normalizeAutomationTargetId(targetId: string) {
  return targetId.replace(/:retry:\d+$/, "");
}









