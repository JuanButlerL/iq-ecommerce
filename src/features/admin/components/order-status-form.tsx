"use client";

import { OrderStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type OrderStatusFormProps = {
  orderId: string;
  currentStatus: OrderStatus;
};

export function OrderStatusForm({ orderId, currentStatus }: OrderStatusFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3 rounded-[2rem] bg-background p-5">
      <Select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>
        {Object.values(OrderStatus).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
      <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota interna" />
      <Button
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const response = await fetch(`/api/admin/orders/${orderId}/status`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                status,
                note,
              }),
            });
            const payload = await response.json();
            setMessage(response.ok ? "Estado actualizado." : payload.error ?? "No se pudo actualizar.");
            router.refresh();
          });
        }}
      >
        {isPending ? "Actualizando..." : "Actualizar estado"}
      </Button>
      {message ? <p className="text-sm text-brand-ink/60">{message}</p> : null}
    </div>
  );
}
