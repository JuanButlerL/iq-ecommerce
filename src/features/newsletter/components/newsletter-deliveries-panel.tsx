"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, History, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import {
  auditActionLabels,
  deliveryStatusMeta,
  formatAdminDateTime,
  newsletterStatusMeta,
  skipReasonLabels,
  type NewsletterDeliveryStatusValue,
  type NewsletterStatusValue,
} from "@/features/newsletter/components/newsletter-admin-labels";
import { NewsletterSendDialog } from "@/features/newsletter/components/newsletter-send-dialog";
import { cn } from "@/lib/utils/cn";

type Stats = { total: number; pending: number; reserved: number; sent: number; skipped: number; errors: number; opened: number; clicked: number };

type DeliveryRow = {
  id: string;
  recipientEmail: string;
  wave: number;
  status: NewsletterDeliveryStatusValue;
  skipReason: string | null;
  errorMessage: string | null;
  providerMessageId: string | null;
  openCount: number;
  firstOpenedAt: string | null;
  clickCount: number;
  firstClickedAt: string | null;
  reservedAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

type AuditRow = { id: string; action: string; actorEmail: string | null; metadata: unknown; createdAt: string };

type Reconcile = { delivery: DeliveryRow; outcome: "sent" | "error" | "retry" };

const reconcileCopy: Record<Reconcile["outcome"], string> = {
  sent: "Marcar como enviado. Hacelo solo si en el panel de Resend figura como entregado o aceptado.",
  error: "Marcar como no enviado. Queda en error y podés reintentarlo después.",
  retry: "Reintentar este envío una sola vez. Sale en la próxima ejecución automática.",
};

export function NewsletterDeliveriesPanel({
  newsletter,
  deliveries,
  auditEvents,
  statusFilter,
  newsletterSendingEnabled,
}: {
  newsletter: { id: string; title: string; status: NewsletterStatusValue; stats: Stats };
  deliveries: DeliveryRow[];
  auditEvents: AuditRow[];
  statusFilter: NewsletterDeliveryStatusValue | null;
  newsletterSendingEnabled: boolean;
}) {
  const router = useRouter();
  const [reconcile, setReconcile] = useState<Reconcile | null>(null);
  const [bulkRetry, setBulkRetry] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const filters: Array<{ value: NewsletterDeliveryStatusValue | null; label: string; count: number }> = [
    { value: null, label: "Todos", count: newsletter.stats.total },
    { value: "SENT", label: "Enviados", count: newsletter.stats.sent },
    { value: "PENDING", label: "Pendientes", count: newsletter.stats.pending },
    { value: "SKIPPED", label: "Omitidos", count: newsletter.stats.skipped },
    { value: "ERROR", label: "Error", count: newsletter.stats.errors },
    { value: "RESERVED", label: "A conciliar", count: newsletter.stats.reserved },
  ];

  async function confirmReconcile({ confirmation }: { confirmation: string }) {
    if (!reconcile) return null;
    try {
      const response = await fetch(`/api/admin/newsletters/deliveries/${reconcile.delivery.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: reconcile.outcome, confirmation }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) return payload.error ?? "No se pudo conciliar.";
      setReconcile(null);
      setMessage(`Envío a ${reconcile.delivery.recipientEmail} actualizado.`);
      router.refresh();
      return null;
    } catch {
      return "No se pudo conciliar.";
    }
  }

  async function confirmBulkRetry({ confirmation }: { confirmation: string }) {
    try {
      const response = await fetch(`/api/admin/newsletters/${newsletter.id}/retry-errors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const payload = (await response.json()) as { data?: { retried: number }; error?: string };
      if (!response.ok) return payload.error ?? "No se pudo reintentar.";
      setBulkRetry(false);
      setMessage(`${payload.data?.retried ?? 0} envíos vuelven a salir en la próxima ejecución.`);
      router.refresh();
      return null;
    } catch {
      return "No se pudo reintentar.";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/newsletter/${newsletter.id}`} className="inline-flex items-center gap-2 text-sm font-extrabold text-brand-pink">
          <ArrowLeft className="h-4 w-4" /> Volver al editor
        </Link>
        <h1 className="mt-2 font-display text-3xl text-brand-ink md:text-4xl">Envíos</h1>
        <p className="mt-1 text-sm text-brand-ink/60">
          {newsletter.title} · <span className="font-bold">{newsletterStatusMeta[newsletter.status].label}</span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Destinatarios", value: newsletter.stats.total },
          { label: "Enviados", value: newsletter.stats.sent },
          { label: "Aperturas", value: newsletter.stats.opened },
          { label: "Clicks", value: newsletter.stats.clicked },
          { label: "Omitidos", value: newsletter.stats.skipped },
          { label: "Error / a conciliar", value: newsletter.stats.errors + newsletter.stats.reserved },
        ].map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="text-2xl font-extrabold text-brand-ink">{tile.value}</p>
            <p className="text-xs font-bold text-brand-ink/55">{tile.label}</p>
          </Card>
        ))}
      </div>

      {newsletter.stats.reserved > 0 ? (
        <Card className="border border-orange-200 bg-orange-50 p-5 text-sm leading-6 text-orange-900">
          <p className="font-bold">Hay envíos “a conciliar”.</p>
          <p>
            Se reservaron pero no se pudo confirmar el resultado (por ejemplo, un corte justo al enviar). No se reintentan solos para no duplicar. Buscá cada casilla en el panel de Resend y marcala como enviada o como no enviada.
          </p>
        </Card>
      ) : null}

      {message ? <p role="status" className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">{message}</p> : null}

      <Card className="p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <Link
                key={filter.label}
                href={filter.value ? `/admin/newsletter/${newsletter.id}/envios?estado=${filter.value}` : `/admin/newsletter/${newsletter.id}/envios`}
                className={cn("rounded-full px-3.5 py-2 text-xs font-extrabold transition", statusFilter === filter.value ? "bg-brand-ink text-white" : "bg-brand-ink/5 text-brand-ink/65 hover:bg-brand-ink/10")}
              >
                {filter.label} · {filter.count}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
          {newsletter.stats.errors > 0 && newsletterSendingEnabled ? (
            <button type="button" onClick={() => setBulkRetry(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-pink px-4 text-sm font-extrabold text-white shadow-soft hover:bg-[#ea737d]">
              <RotateCcw className="h-4 w-4" /> Reintentar {newsletter.stats.errors} con error
            </button>
          ) : null}
          <a href={`/api/admin/newsletters/${newsletter.id}/deliveries/export`} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:bg-white">
            <Download className="h-4 w-4" /> Exportar CSV
          </a>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.1em] text-brand-ink/45">
              <tr>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Tanda</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Enviado</th>
                <th className="py-2 pr-3">Aperturas</th>
                <th className="py-2 pr-3">Clicks</th>
                <th className="py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-brand-ink/45">
                    No hay envíos con este filtro.
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery) => (
                  <tr key={delivery.id} className="border-t border-brand-ink/8 align-top">
                    <td className="py-3 pr-3 font-bold text-brand-ink">{delivery.recipientEmail}</td>
                    <td className="py-3 pr-3">{delivery.wave}</td>
                    <td className="py-3 pr-3">
                      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em]", deliveryStatusMeta[delivery.status].className)}>{deliveryStatusMeta[delivery.status].label}</span>
                      {delivery.skipReason ? <p className="mt-1 text-xs text-brand-ink/50">{skipReasonLabels[delivery.skipReason] ?? delivery.skipReason}</p> : null}
                      {delivery.errorMessage ? <p className="mt-1 max-w-[260px] text-xs text-red-600">{delivery.errorMessage}</p> : null}
                    </td>
                    <td className="py-3 pr-3 text-brand-ink/65">{formatAdminDateTime(delivery.sentAt ?? delivery.reservedAt)}</td>
                    <td className="py-3 pr-3">{delivery.openCount}</td>
                    <td className="py-3 pr-3">{delivery.clickCount}</td>
                    <td className="py-3">
                      {delivery.status === "RESERVED" ? (
                        <div className="flex flex-col gap-1">
                          <button type="button" className="text-left text-xs font-extrabold text-green-700 hover:underline" onClick={() => setReconcile({ delivery, outcome: "sent" })}>
                            Figura enviado
                          </button>
                          <button type="button" className="text-left text-xs font-extrabold text-red-600 hover:underline" onClick={() => setReconcile({ delivery, outcome: "error" })}>
                            No se envió
                          </button>
                        </div>
                      ) : null}
                      {delivery.status === "ERROR" && newsletterSendingEnabled ? (
                        <button type="button" className="text-xs font-extrabold text-brand-pink hover:underline" onClick={() => setReconcile({ delivery, outcome: "retry" })}>
                          Reintentar una vez
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5 md:p-6">
        <p className="flex items-center gap-2 font-display text-2xl">
          <History className="h-5 w-5 text-brand-pink" /> Auditoría
        </p>
        <ol className="mt-4 space-y-3">
          {auditEvents.map((event) => (
            <li key={event.id} className="rounded-2xl bg-brand-ink/[0.03] px-4 py-3 text-sm">
              <p className="font-bold text-brand-ink">{auditActionLabels[event.action] ?? event.action}</p>
              <p className="text-xs text-brand-ink/50">
                {formatAdminDateTime(event.createdAt)} · {event.actorEmail ?? "Sistema"}
              </p>
              {event.metadata && typeof event.metadata === "object" && Object.keys(event.metadata as object).length > 0 ? (
                <p className="mt-1 break-all font-mono text-[11px] text-brand-ink/45">{JSON.stringify(event.metadata)}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </Card>

      {bulkRetry ? (
        <NewsletterSendDialog mode="retry-errors" description={`${newsletter.stats.errors} envíos con error vuelven a intentarse una sola vez.`} onClose={() => setBulkRetry(false)} onConfirm={confirmBulkRetry} />
      ) : null}

      {reconcile ? (
        <NewsletterSendDialog mode="reconcile" description={`${reconcile.delivery.recipientEmail}: ${reconcileCopy[reconcile.outcome]}`} onClose={() => setReconcile(null)} onConfirm={confirmReconcile} />
      ) : null}
    </div>
  );
}
