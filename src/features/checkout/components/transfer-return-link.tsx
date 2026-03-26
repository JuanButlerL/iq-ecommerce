"use client";

import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type TransferReturnLinkProps = {
  orderNumber: string;
};

export function TransferReturnLink({ orderNumber }: TransferReturnLinkProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && Boolean(navigator.share));
  }, []);

  const handleSaveLink = () => {
    startTransition(async () => {
      const url = window.location.href;

      try {
        if (navigator.share) {
          await navigator.share({
            title: `Pedido ${orderNumber}`,
            text: `Guardá este link para volver a subir el comprobante del pedido ${orderNumber}.`,
            url,
          });
          setMessage("Acceso compartido.");
          return;
        }

        await navigator.clipboard.writeText(url);
        setMessage("Link copiado.");
      } catch {
        setMessage("No pudimos compartir el acceso.");
      }
    });
  };

  return (
    <div className="rounded-[1.5rem] bg-brand-mint/60 p-4 text-sm text-brand-ink">
      <div className="flex items-start gap-3">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-pink" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Antes de abrir tu banco</p>
          <p className="mt-1 text-brand-ink/80">
            Guardá este acceso para volver rápido y subir el comprobante después de pagar.
          </p>
          <div className="mt-3">
            <Button type="button" variant="secondary" className="w-full sm:w-auto" disabled={isPending} onClick={handleSaveLink}>
              {message === "Link copiado." || message === "Acceso compartido." ? (
                <Check className="h-4 w-4" />
              ) : canShare ? (
                <Share2 className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {isPending ? "Guardando..." : "Guardar acceso a este pedido"}
            </Button>
          </div>
          {message ? <p className="mt-2 text-xs text-brand-ink/65">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}
