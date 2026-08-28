"use client";

import type { EmailAutomationTrigger, EmailSendStatus } from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatArs } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

type LogItem = {
  id: string;
  trigger: EmailAutomationTrigger;
  status: EmailSendStatus;
  recipientEmail: string;
  subject: string;
  targetType: string;
  targetId: string;
  errorMessage: string | null;
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
    createdAt: Date;
    paymentStatus: string;
    totalArs: number;
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

type EmailAuditPanelProps = {
  recentLogs: LogItem[];
  logFilters: {
    desde: string;
    hasta: string;
  };
};

const triggerLabels: Record<EmailAutomationTrigger, string> = {
  WELCOME_LEAD: "Bienvenida temprana",
  CART_ABANDONED: "Recuperacion sin compra",
  ORDER_CREATED: "Pedido recibido",
  POST_PURCHASE: "Post compra",
};

const statusLabels: Record<EmailSendStatus, string> = {
  SENT: "Enviado",
  SKIPPED: "Omitido",
  ERROR: "Error",
};

export function EmailAuditPanel({ recentLogs, logFilters }: EmailAuditPanelProps) {
  const latestLogByCase = new Map<string, LogItem>();

  for (const log of recentLogs) {
    const caseKey = getAuditCaseKey(log);

    if (!latestLogByCase.has(caseKey)) {
      latestLogByCase.set(caseKey, log);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Auditoria CRM</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Historial de emails</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/65">
            Control operativo de enviados, omitidos y errores. Todas las fechas se muestran en horario Argentina.
          </p>
        </div>
        <Link
          href="/admin/emails"
          className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 transition hover:bg-brand-peach"
        >
          Volver a emails
        </Link>
      </div>

      <Card className="p-5 md:p-6">
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] lg:max-w-2xl" method="get">
          <Field label="Desde">
            <Input type="date" name="desde" defaultValue={logFilters.desde} />
          </Field>
          <Field label="Hasta">
            <Input type="date" name="hasta" defaultValue={logFilters.hasta} />
          </Field>
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </form>
      </Card>

      <Card className="p-5 md:p-6">
        <div className="mb-5 grid gap-3 md:grid-cols-4">
          <Metric label="Enviados" value={recentLogs.filter((log) => log.status === "SENT").length.toString()} />
          <Metric label="Con click" value={recentLogs.filter((log) => log.clickCount > 0).length.toString()} />
          <Metric label="Ventas atribuidas" value={recentLogs.filter((log) => log.convertedAt).length.toString()} />
          <Metric label="Errores" value={recentLogs.filter((log) => log.status === "ERROR").length.toString()} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead>
              <tr className="border-b border-brand-ink/10 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink/45">
                <th className="py-3 pr-4">Estado</th>
                <th className="py-3 pr-4">Mail</th>
                <th className="py-3 pr-4">Automatizacion</th>
                <th className="py-3 pr-4">Disparador</th>
                <th className="py-3 pr-4">Fecha envio/log</th>
                <th className="py-3 pr-4">Fecha inicio</th>
                <th className="py-3 pr-4">Click</th>
                <th className="py-3 pr-4">Venta atribuida</th>
                <th className="py-3 pr-4">Objetivo</th>
                <th className="py-3 pr-4">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length ? (
                recentLogs.map((log) => (
                  <tr key={log.id} className="border-b border-brand-ink/10 align-top">
                    <td className="py-3 pr-4">
                      <StatusBadge status={log.status} />
                      {renderFinalStatus(log, latestLogByCase)}
                    </td>
                    <td className="py-3 pr-4 font-bold text-brand-ink">{log.recipientEmail}</td>
                    <td className="py-3 pr-4 text-brand-ink/70">{log.automation.name}</td>
                    <td className="py-3 pr-4 text-brand-ink/70">{triggerLabels[log.trigger]}</td>
                    <td className="py-3 pr-4 text-brand-ink/70">{formatArgentinaDateTime(new Date(log.sentAt ?? log.createdAt))}</td>
                    <td className="py-3 pr-4 text-brand-ink/70">{getLogStartDate(log)}</td>
                    <td className="py-3 pr-4 text-brand-ink/70">
                      {log.clickCount > 0 ? (
                        <div>
                          <p className="font-bold text-brand-ink">{log.clickCount} click{log.clickCount === 1 ? "" : "s"}</p>
                          <p className="text-xs text-brand-ink/55">{log.lastClickedAt ? formatArgentinaDateTime(new Date(log.lastClickedAt)) : "-"}</p>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3 pr-4 text-brand-ink/70">
                      {log.convertedOrderNumber ? (
                        <div>
                          <p className="font-bold text-emerald-700">{log.convertedOrderNumber}</p>
                          <p className="text-xs text-brand-ink/55">{log.convertedAt ? formatArgentinaDateTime(new Date(log.convertedAt)) : "-"}</p>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3 pr-4 text-brand-ink/70">{getLogTargetLabel(log)}</td>
                    <td className="py-3 pr-4 text-brand-ink/60">
                      <p className="max-w-[280px] font-bold text-brand-ink">{log.subject}</p>
                      {log.errorMessage ? <p className="mt-1 max-w-[280px] text-xs font-bold text-red-700">{log.errorMessage}</p> : null}
                      {log.cartRecoveryLead ? (
                        <p className="mt-1 text-xs">
                          Carrito {formatArs(log.cartRecoveryLead.subtotalArs)} Â· {log.cartRecoveryLead.status}
                        </p>
                      ) : null}
                      {log.order ? <p className="mt-1 text-xs">Pedido {formatArs(log.order.totalArs)} Â· {log.order.paymentStatus}</p> : null}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-brand-ink/55">
                    No hay emails para el filtro seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function getLogStartDate(log: LogItem) {
  const start =
    log.trigger === "WELCOME_LEAD"
      ? log.cartRecoveryLead?.createdAt
      : log.trigger === "CART_ABANDONED"
      ? log.cartRecoveryLead?.createdAt
      : log.trigger === "POST_PURCHASE"
        ? log.order?.paidAt ?? log.order?.paymentProofs[0]?.uploadedAt ?? log.order?.createdAt
        : log.order?.createdAt;

  return start ? formatArgentinaDateTime(new Date(start)) : "-";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-background px-4 py-3">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink/45">{label}</p>
      <p className="mt-2 font-display text-2xl text-brand-ink">{value}</p>
    </div>
  );
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

function getAuditCaseKey(log: LogItem) {
  if (log.targetType === "cart_recovery_lead") {
    return `${log.targetType}:${normalizeCartRecoveryTargetId(log.targetId)}`;
  }

  return `${log.targetType}:${log.targetId}`;
}

function normalizeCartRecoveryTargetId(targetId: string) {
  return targetId.replace(/:retry:\d+$/, "");
}

function renderFinalStatus(log: LogItem, latestLogByCase: Map<string, LogItem>) {
  const latestLog = latestLogByCase.get(getAuditCaseKey(log));

  if (!latestLog || latestLog.id === log.id || latestLog.status === log.status) {
    return null;
  }

  return (
    <p className="mt-2 text-[11px] font-bold leading-4 text-brand-ink/55">
      Estado final: <span className={latestLog.status === "SENT" ? "text-emerald-700" : latestLog.status === "ERROR" ? "text-red-700" : "text-brand-ink/60"}>{statusLabels[latestLog.status]}</span>
      {" Â· "}
      {formatArgentinaDateTime(new Date(latestLog.sentAt ?? latestLog.createdAt))}
    </p>
  );
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

