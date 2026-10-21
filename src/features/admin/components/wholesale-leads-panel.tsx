"use client";

import Link from "next/link";
import { Download, Mail, MailWarning } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WHOLESALE_LEAD_STATUS_LABELS } from "@/features/wholesale/lead-status";
import { cn } from "@/lib/utils/cn";
import { buildWhatsappUrl } from "@/lib/utils/whatsapp";

type LeadStatus = "NEW" | "CONTACTED" | "CLIENT" | "DISCARDED";

type LeadItem = {
  id: string;
  status: LeadStatus;
  createdAt: string;
  name: string;
  businessName: string | null;
  businessType: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  cuit: string | null;
  address: string;
  reference: string | null;
  monthlyVolume: string | null;
  message: string | null;
  adminNotes: string;
  notified: boolean;
  notificationError: string | null;
};

type WholesaleLeadsPanelProps = {
  leads: LeadItem[];
  status: LeadStatus | null;
  counts: Partial<Record<LeadStatus, number>>;
  notificationEmails: string[];
};

const statusLabels = WHOLESALE_LEAD_STATUS_LABELS;

const statusStyles: Record<LeadStatus, string> = {
  NEW: "bg-brand-pink text-white",
  CONTACTED: "bg-brand-cyan/40 text-brand-ink",
  CLIENT: "bg-brand-mint text-brand-ink",
  DISCARDED: "bg-brand-ink/10 text-brand-ink/60",
};

function LeadCard({ lead }: { lead: LeadItem }) {
  const router = useRouter();
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.adminNotes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(data: { status?: LeadStatus; adminNotes?: string }) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/wholesale-leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No pudimos guardar.");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setSaving(false);
    }
  }

  const details: [string, string | null][] = [
    ["Teléfono", lead.phone],
    ["Email", lead.email],
    ["CUIT", lead.cuit],
    ["Dirección", lead.address],
    ["Referencia", lead.reference],
    ["Cantidad estimada", lead.monthlyVolume],
  ];

  return (
    <Card className="space-y-4 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.08em]", statusStyles[status])}>{statusLabels[status]}</span>
            <span className="text-xs text-brand-ink/50">{lead.createdAt}</span>
            {lead.notificationError ? (
              <span title={lead.notificationError} className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                <MailWarning className="h-3.5 w-3.5" /> Aviso por email con error
              </span>
            ) : lead.notified ? (
              <span className="inline-flex items-center gap-1 text-xs text-brand-ink/50">
                <Mail className="h-3.5 w-3.5" /> Aviso enviado
              </span>
            ) : null}
          </div>
          <p className="mt-2 font-display text-2xl leading-none text-brand-ink">{lead.businessName || lead.name}</p>
          <p className="mt-1 text-sm text-brand-ink/60">
            {lead.businessType}
            {lead.businessName ? ` · ${lead.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={buildWhatsappUrl(lead.whatsappNumber, `Hola ${lead.name}! Te escribimos de iQ Kids por tu consulta de venta mayorista.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-extrabold text-white hover:brightness-95"
          >
            <WhatsappIcon className="h-4 w-4" /> WhatsApp
          </a>
          <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:ring-brand-pink/40">
            <Mail className="h-4 w-4" /> Email
          </a>
          <Select
            aria-label="Estado"
            value={status}
            disabled={saving}
            className="h-10 w-40"
            onChange={async (event) => {
              const next = event.target.value as LeadStatus;
              const previous = status;
              setStatus(next);
              if (!(await update({ status: next }))) setStatus(previous);
            }}
          >
            {(Object.keys(statusLabels) as LeadStatus[]).map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {details
          .filter((detail): detail is [string, string] => Boolean(detail[1]))
          .map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs font-bold text-brand-ink/50">{label}</dt>
              <dd className="break-words text-brand-ink">{value}</dd>
            </div>
          ))}
      </dl>
      {lead.message ? (
        <div className="rounded-2xl bg-[#fff6f7] p-4 text-sm">
          <p className="text-xs font-bold text-brand-ink/50">Mensaje</p>
          <p className="mt-1 whitespace-pre-line text-brand-ink">{lead.message}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="grid gap-1.5 text-xs font-bold text-brand-ink/60">
          Notas internas
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20" placeholder="Ej: le mandamos lista de precios el martes." />
        </label>
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" variant="outline" disabled={saving || notes === lead.adminNotes} onClick={() => void update({ adminNotes: notes })}>
            Guardar nota
          </Button>
          {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
        </div>
      </div>
    </Card>
  );
}

export function WholesaleLeadsPanel({ leads, status, counts, notificationEmails }: WholesaleLeadsPanelProps) {
  const total = Object.values(counts).reduce((sum, value) => sum + (value ?? 0), 0);
  const filters: { key: LeadStatus | null; label: string; count: number }[] = [
    { key: null, label: "Todas", count: total },
    ...(Object.keys(statusLabels) as LeadStatus[]).map((key) => ({ key, label: statusLabels[key], count: counts[key] ?? 0 })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Mayoristas</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Consultas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/70 md:text-base">
            Lo que se completa en “Soy nuevo” de /mayoristas.{" "}
            {notificationEmails.length > 0 ? (
              <>Cada consulta nueva avisa por email a {notificationEmails.join(", ")}.</>
            ) : (
              <>No hay casillas configuradas para el aviso por email.</>
            )}{" "}
            <Link href="/admin/mayoristas/pedido" className="font-bold text-brand-pink hover:underline">
              Cambiar
            </Link>
          </p>
        </div>
        <Link
          href="/api/admin/wholesale-leads/export"
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:ring-brand-pink/40"
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            key={filter.label}
            href={filter.key ? `/admin/mayoristas/consultas?estado=${filter.key.toLowerCase()}` : "/admin/mayoristas/consultas"}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-extrabold transition",
              status === filter.key ? "bg-brand-ink text-white" : "bg-white text-brand-ink ring-1 ring-brand-ink/10 hover:ring-brand-pink/40",
            )}
          >
            {filter.label} <span className="opacity-60">{filter.count}</span>
          </Link>
        ))}
      </div>

      {leads.length === 0 ? (
        <Card className="p-8 text-center text-sm text-brand-ink/60">Todavía no hay consultas{status ? " con este estado" : ""}.</Card>
      ) : (
        <div className="space-y-4">
          {leads.map((lead) => (
            <LeadCard key={`${lead.id}-${lead.status}-${lead.adminNotes}`} lead={lead} />
          ))}
        </div>
      )}
    </div>
  );
}
