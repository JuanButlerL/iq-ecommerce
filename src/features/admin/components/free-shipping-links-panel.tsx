"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FREE_SHIPPING_LINK_DEFAULT_HOURS } from "@/features/free-shipping-links/constants";
import type { FreeShippingLinkStatus } from "@/features/free-shipping-links/service";
import { cn } from "@/lib/utils/cn";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

type FreeShippingLinkItem = {
  id: string;
  email: string;
  note: string | null;
  url: string;
  status: FreeShippingLinkStatus;
  expiresAt: Date;
  redeemedAt: Date | null;
  revokedAt: Date | null;
  orderNumber: string | null;
  createdBy: string | null;
  createdAt: Date;
};

const statusLabels: Record<FreeShippingLinkStatus, string> = {
  ACTIVE: "Vigente",
  REDEEMED: "Usado",
  EXPIRED: "Vencido",
  REVOKED: "Anulado",
};

const durationPresets = [
  { label: "24 h", hours: 24 },
  { label: "72 h", hours: 72 },
  { label: "7 días", hours: 24 * 7 },
];

function parseEmails(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function FreeShippingLinksPanel({ links }: { links: FreeShippingLinkItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [emailsText, setEmailsText] = useState("");
  const [hours, setHours] = useState(FREE_SHIPPING_LINK_DEFAULT_HOURS);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const emails = useMemo(() => parseEmails(emailsText), [emailsText]);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredLinks = normalizedSearch
    ? links.filter((link) => [link.email, link.note ?? "", link.orderNumber ?? ""].some((value) => value.toLowerCase().includes(normalizedSearch)))
    : links;
  const activeCount = links.filter((link) => link.status === "ACTIVE").length;
  const redeemedCount = links.filter((link) => link.status === "REDEEMED").length;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/admin/free-shipping-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, hours, note }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "No se pudieron generar los links.");
        return;
      }

      setMessage(`${payload.data.count} link${payload.data.count === 1 ? "" : "s"} generado${payload.data.count === 1 ? "" : "s"}. Copialos desde la lista.`);
      setEmailsText("");
      setNote("");
      router.refresh();
    });
  }

  function handleRevoke(link: FreeShippingLinkItem) {
    if (!window.confirm(`¿Anular el link de envío gratis de ${link.email}? No se puede deshacer.`)) {
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch(`/api/admin/free-shipping-links/${link.id}/revoke`, { method: "POST" });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error || "No se pudo anular el link.");
        return;
      }

      setMessage(`Link de ${link.email} anulado.`);
      router.refresh();
    });
  }

  async function handleCopy(link: FreeShippingLinkItem) {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
      window.setTimeout(() => setCopiedId((current) => (current === link.id ? null : current)), 2000);
    } catch {
      window.prompt("Copiá el link:", link.url);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Tienda</p>
        <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Links de envío gratis</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/65">
          Cada link es personal: da envío gratis una sola vez, solo si la compra se hace con ese email y antes de que venza. No tiene pedido
          mínimo y se puede combinar con cupones.
        </p>
      </div>

      <Card className="p-5 md:p-6">
        <form className="grid gap-4 lg:grid-cols-[1.3fr_1fr]" onSubmit={handleSubmit}>
          <Field label="Emails">
            <Textarea
              value={emailsText}
              onChange={(event) => setEmailsText(event.target.value)}
              rows={5}
              placeholder={"cliente@correo.com\notro@correo.com"}
              required
            />
            <p className="mt-2 text-xs text-brand-ink/55">
              Uno por línea o separados por coma. Se genera un link por email{emails.length ? ` (${emails.length})` : ""}.
            </p>
          </Field>
          <div className="space-y-4">
            <Field label="Vence en (horas)">
              <Input type="number" min={1} max={720} value={hours} onChange={(event) => setHours(Number(event.target.value))} required />
              <div className="mt-2 flex flex-wrap gap-2">
                {durationPresets.map((preset) => (
                  <button
                    key={preset.hours}
                    type="button"
                    onClick={() => setHours(preset.hours)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-extrabold ring-1 transition",
                      hours === preset.hours ? "bg-brand-ink text-white ring-brand-ink" : "bg-white text-brand-ink ring-brand-ink/15 hover:bg-brand-peach",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Nota (opcional)">
              <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} placeholder="Ej: reclamo pedido IQ-1234" />
            </Field>
            <Button type="submit" className="w-full" disabled={isPending || emails.length === 0}>
              {isPending ? "Generando..." : `Generar link${emails.length > 1 ? "s" : ""}`}
            </Button>
          </div>
        </form>
        {error ? <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
        {message ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</p> : null}
      </Card>

      <Card className="p-5 md:p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex gap-6">
            <Metric label="Vigentes" value={activeCount} />
            <Metric label="Usados" value={redeemedCount} />
            <Metric label="Total" value={links.length} />
          </div>
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por email, nota o pedido"
            className="md:max-w-xs"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-brand-ink/10 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink/45">
                <th className="py-3 pr-4">Estado</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">Link</th>
                <th className="py-3 pr-4">Vence</th>
                <th className="py-3 pr-4">Pedido</th>
                <th className="py-3 pr-4">Nota</th>
                <th className="py-3 pr-4">Creado</th>
                <th className="py-3 pr-4" />
              </tr>
            </thead>
            <tbody>
              {filteredLinks.length ? (
                filteredLinks.map((link) => (
                  <tr key={link.id} className="border-b border-brand-ink/10 align-top">
                    <td className="py-3 pr-4">
                      <StatusBadge status={link.status} />
                    </td>
                    <td className="py-3 pr-4 font-bold text-brand-ink">{link.email}</td>
                    <td className="py-3 pr-4">
                      {link.status === "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => handleCopy(link)}
                          className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-brand-ink ring-1 ring-brand-ink/15 transition hover:bg-brand-peach"
                          title={link.url}
                        >
                          {copiedId === link.id ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedId === link.id ? "Copiado" : "Copiar link"}
                        </button>
                      ) : (
                        <span className="text-brand-ink/40">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-brand-ink/70">{formatArgentinaDateTime(new Date(link.expiresAt))}</td>
                    <td className="py-3 pr-4 text-brand-ink/70">
                      {link.status === "REDEEMED" ? (
                        <div>
                          <p className="font-bold text-emerald-700">{link.orderNumber ?? "Pedido eliminado"}</p>
                          {link.redeemedAt ? <p className="text-xs text-brand-ink/55">{formatArgentinaDateTime(new Date(link.redeemedAt))}</p> : null}
                        </div>
                      ) : link.status === "REVOKED" && link.revokedAt ? (
                        <p className="text-xs text-brand-ink/55">Anulado {formatArgentinaDateTime(new Date(link.revokedAt))}</p>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="max-w-[220px] py-3 pr-4 text-brand-ink/70">{link.note || "-"}</td>
                    <td className="whitespace-nowrap py-3 pr-4 text-brand-ink/70">
                      <p>{formatArgentinaDateTime(new Date(link.createdAt))}</p>
                      {link.createdBy ? <p className="text-xs text-brand-ink/55">{link.createdBy}</p> : null}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {link.status === "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => handleRevoke(link)}
                          disabled={isPending}
                          className="text-xs font-extrabold text-red-700 hover:underline disabled:opacity-50"
                        >
                          Anular
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-brand-ink/55">
                    {links.length ? "No hay links que coincidan con la búsqueda." : "Todavía no generaste links de envío gratis."}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-brand-ink">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink/45">{label}</p>
      <p className="mt-1 font-display text-2xl text-brand-ink">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: FreeShippingLinkStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.12em]",
        status === "ACTIVE"
          ? "bg-emerald-50 text-emerald-700"
          : status === "REDEEMED"
            ? "bg-sky-50 text-sky-700"
            : status === "REVOKED"
              ? "bg-red-50 text-red-700"
              : "bg-brand-ink/5 text-brand-ink/50",
      )}
    >
      {statusLabels[status]}
    </span>
  );
}
