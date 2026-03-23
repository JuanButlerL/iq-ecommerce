"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type RetrySyncButtonProps = {
  orderNumber: string;
};

export function RetrySyncButton({ orderNumber }: RetrySyncButtonProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const response = await fetch(`/api/orders/${orderNumber}/sync`, {
              method: "POST",
            });
            const payload = await response.json();
            setMessage(response.ok ? "Sync reintentado." : payload.error ?? "No se pudo reintentar.");
            router.refresh();
          });
        }}
      >
        {isPending ? "Reintentando..." : "Reintentar sync"}
      </Button>
      {message ? <p className="text-sm text-brand-ink/60">{message}</p> : null}
    </div>
  );
}
