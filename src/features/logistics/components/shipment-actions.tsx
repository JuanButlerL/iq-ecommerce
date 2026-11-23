"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";

type Props = { shipmentId: string; status: string; hasLabel: boolean };

export function ShipmentActions({ shipmentId, status, hasLabel }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function send(body: BodyInit, json: boolean, success: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/admin/shipments/${shipmentId}`, {
        method: "POST",
        ...(json ? { headers: { "Content-Type": "application/json" } } : {}),
        body,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "No se pudo hacer.");
        return;
      }
      const result = payload.data?.result;
      setMessage(result && result.success === false ? `Falló otra vez: ${result.error}` : success);
      router.refresh();
    });
  }

  function retry() {
    const label = status === "WAITING_PAYMENT" ? "¿Generar la etiqueta ahora, antes de que se confirme el pago?" : "¿Reintentar ahora?";
    if (!window.confirm(label)) return;
    send(JSON.stringify({ action: "retry" }), true, "Listo.");
  }

  function manualTracking() {
    const value = window.prompt("Número de seguimiento (si la generaste a mano en el portal del transportista):");
    if (!value) return;
    send(JSON.stringify({ action: "tracking", trackingNumber: value }), true, "Seguimiento guardado.");
  }

  function cancel() {
    const reason = window.prompt("¿Por qué se cancela el envío?");
    if (reason === null) return;
    send(JSON.stringify({ action: "cancel", reason }), true, "Envío cancelado.");
  }

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const form = new FormData();
    form.append("label", file);
    send(form, false, "Etiqueta subida.");
  }

  const canRetry = ["WAITING_PAYMENT", "PENDING", "ERROR", "NEEDS_REVIEW"].includes(status);
  const open = status !== "CANCELLED";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canRetry ? (
          <Button type="button" size="sm" disabled={isPending} onClick={retry}>
            {status === "WAITING_PAYMENT" ? "Generar etiqueta ahora" : "Reintentar"}
          </Button>
        ) : null}
        {open && status !== "CREATED" ? (
          <Button type="button" size="sm" variant="secondary" disabled={isPending} onClick={manualTracking}>Cargar seguimiento</Button>
        ) : null}
        {open && !hasLabel ? (
          <label className="inline-flex h-10 cursor-pointer items-center rounded-full bg-white px-4 text-sm font-bold text-brand-ink ring-1 ring-brand-ink/10">
            Subir etiqueta
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={upload} disabled={isPending} />
          </label>
        ) : null}
        {open ? (
          <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={cancel}>Cancelar envío</Button>
        ) : null}
      </div>
      {error ? <p className="text-sm font-bold text-red-700">{error}</p> : null}
      {message ? <p className="text-sm font-bold text-green-800">{message}</p> : null}
    </div>
  );
}
