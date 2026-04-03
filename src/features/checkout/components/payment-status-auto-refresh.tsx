"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PaymentMethod, PaymentStatus } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { useCartStore } from "@/features/cart/store";

type PaymentStatusAutoRefreshProps = {
  orderNumber: string;
  paymentMethod: PaymentMethod;
  initialPaymentStatus: PaymentStatus;
  paymentId?: string | null;
};

export function PaymentStatusAutoRefresh({
  orderNumber,
  paymentMethod,
  initialPaymentStatus,
  paymentId,
}: PaymentStatusAutoRefreshProps) {
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clear);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hasAutoChecked, setHasAutoChecked] = useState(false);

  useEffect(() => {
    if (initialPaymentStatus === PaymentStatus.PAID) {
      clearCart();
    }
  }, [clearCart, initialPaymentStatus]);

  useEffect(() => {
    if (
      hasAutoChecked ||
      paymentMethod !== PaymentMethod.MERCADO_PAGO ||
      initialPaymentStatus === PaymentStatus.PAID ||
      !paymentId
    ) {
      return;
    }

    setHasAutoChecked(true);

    startTransition(async () => {
      const response = await fetch(`/api/orders/${orderNumber}/payment-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentId }),
      });

      if (!response.ok) {
        setError("No pudimos actualizar el estado del pago en este momento.");
        return;
      }

      clearCart();
      router.refresh();
    });
  }, [clearCart, hasAutoChecked, initialPaymentStatus, orderNumber, paymentId, paymentMethod, router, startTransition]);

  if (paymentMethod !== PaymentMethod.MERCADO_PAGO || initialPaymentStatus === PaymentStatus.PAID) {
    return null;
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
      <Button
        type="button"
        variant="secondary"
        className="w-full sm:w-auto"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const response = await fetch(`/api/orders/${orderNumber}/payment-status`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ paymentId }),
            });

            if (!response.ok) {
              setError("No pudimos revisar el estado del pago.");
              return;
            }

            clearCart();
            router.refresh();
          });
        }}
      >
        {isPending ? "Actualizando estado..." : "Revisar estado del pago"}
      </Button>
    </div>
  );
}
