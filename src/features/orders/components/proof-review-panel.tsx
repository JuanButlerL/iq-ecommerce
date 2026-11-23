"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatArs } from "@/lib/utils/currency";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

type Proof = {
  id: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string | Date;
  reviewStatus: string;
  rejectionReason: string | null;
  transferSenderName: string | null;
  transferReference: string | null;
  customerNote: string | null;
  url: string | null;
};

type Item = {
  id: string;
  publicOrderNumber: string;
  channel: string;
  createdAt: string | Date;
  customerName: string;
  customerEmail: string;
  customerTaxId: string | null;
  paymentMethod: string;
  totalArs: number;
  shippingCarrier: string | null;
  proofs: Proof[];
};

const carrierLabels: Record<string, string> = { OWN: "Reparto propio", ANDREANI: "Andreani", CORREO_AR: "Correo Argentino" };

export function ProofReviewPanel({ items, emailEnabled }: { items: Item[]; emailEnabled: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function act(item: Item, action: "approve" | "reject") {
    let reason = "";
    if (action === "reject") {
      const answer = window.prompt(`¿Por qué se rechaza el comprobante de ${item.publicOrderNumber}? (le llega al cliente por mail)`);
      if (answer === null) return;
      reason = answer;
    } else if (!window.confirm(`¿Aprobar el pago de ${item.publicOrderNumber} por ${formatArs(item.totalArs)}? Se genera la etiqueta y pasa a la app.`)) {
      return;
    }
    setError(null);
    setMessage(null);
    setBusyId(item.id);
    startTransition(async () => {
      const response = await fetch(`/api/admin/orders/${item.id}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const payload = await response.json().catch(() => ({}));
      setBusyId(null);
      if (!response.ok) {
        setError(payload.error ?? "No se pudo guardar.");
        return;
      }
      setMessage(
        action === "approve"
          ? `${item.publicOrderNumber} aprobado.`
          : `${item.publicOrderNumber} rechazado.${payload.data?.emailSent ? " Le mandamos un mail al cliente." : " No se pudo mandar el mail: avisale por WhatsApp."}`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-pink">Ventas</p>
        <h1 className="font-display text-4xl text-brand-ink">Comprobantes para revisar</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-ink/70">
          Pedidos con transferencia o eCheq que subieron comprobante. Al aprobar, el pedido queda pago, se genera la etiqueta, se le manda el seguimiento al
          cliente y viaja a la app. Al rechazar, vuelve a pendiente de pago y le pedimos que lo suba de nuevo.
        </p>
      </div>
      {!emailEnabled ? <p className="rounded-2xl bg-brand-yellow/30 p-4 text-sm font-bold text-brand-ink">El envío de emails está apagado: los clientes no reciben el aviso.</p> : null}
      {error ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-brand-mint p-4 text-sm font-bold text-green-800">{message}</p> : null}
      {items.length === 0 ? <Card className="p-6 text-sm text-brand-ink/70">No hay comprobantes pendientes.</Card> : null}

      {items.map((item) => {
        const proof = item.proofs[0];
        const previous = item.proofs.filter((p) => p.reviewStatus === "REJECTED");
        return (
          <Card key={item.id} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-2 text-sm text-brand-ink">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/pedidos/${item.id}`} className="font-display text-2xl hover:text-brand-pink">{item.publicOrderNumber}</Link>
                <span className="rounded-full bg-brand-ink/5 px-2 py-0.5 text-xs font-bold">{item.channel === "WHOLESALE" ? "Mayorista" : "Minorista"}</span>
                <span className="rounded-full bg-brand-ink/5 px-2 py-0.5 text-xs font-bold">{item.paymentMethod === "ECHEQ" ? "eCheq" : "Transferencia"}</span>
                {item.shippingCarrier ? <span className="rounded-full bg-brand-ink/5 px-2 py-0.5 text-xs font-bold">{carrierLabels[item.shippingCarrier]}</span> : null}
              </div>
              <p><b>{item.customerName}</b> · {item.customerEmail}{item.customerTaxId ? ` · ${item.channel === "WHOLESALE" ? "CUIT" : "DNI"} ${item.customerTaxId}` : ""}</p>
              <p className="font-display text-3xl">{formatArs(item.totalArs)}</p>
              {proof ? (
                <div className="space-y-0.5 text-brand-ink/70">
                  <p>Subido: {formatArgentinaDateTime(new Date(proof.uploadedAt))}</p>
                  {proof.transferSenderName ? <p>Titular / DNI informado: {proof.transferSenderName}</p> : null}
                  {proof.transferReference ? <p>Referencia: {proof.transferReference}</p> : null}
                  {proof.customerNote ? <p>Nota del cliente: {proof.customerNote}</p> : null}
                </div>
              ) : null}
              {previous.length > 0 ? <p className="text-xs text-red-700">Ya se rechazaron {previous.length} comprobante(s) de este pedido.</p> : null}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" disabled={isPending} onClick={() => act(item, "approve")}>
                  {busyId === item.id ? "Guardando..." : "Aprobar pago"}
                </Button>
                <Button type="button" variant="secondary" disabled={isPending} onClick={() => act(item, "reject")}>Rechazar</Button>
              </div>
            </div>
            <div>
              {proof?.url ? (
                proof.mimeType.startsWith("image/") ? (
                  <a href={proof.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed URL from the private bucket */}
                    <img src={proof.url} alt={`Comprobante ${item.publicOrderNumber}`} className="max-h-80 w-full rounded-xl object-contain ring-1 ring-brand-ink/10" />
                  </a>
                ) : (
                  <a href={proof.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10">
                    Abrir {proof.fileName}
                  </a>
                )
              ) : (
                <p className="text-sm text-brand-ink/50">Sin archivo.</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
