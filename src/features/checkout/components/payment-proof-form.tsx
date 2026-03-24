"use client";

import { FileText, ImageIcon, ShieldCheck, Upload, WandSparkles } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/features/cart/store";
import { paymentProofFormSchema, type PaymentProofFormInput } from "@/lib/validations/proof";

type PaymentProofFormProps = {
  orderNumber: string;
};

export function PaymentProofForm({ orderNumber }: PaymentProofFormProps) {
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clear);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<PaymentProofFormInput>({
    resolver: zodResolver(paymentProofFormSchema),
    defaultValues: {
      transferSenderName: "",
    },
  });

  useEffect(() => {
    if (!file || file.type === "application/pdf") {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="space-y-5 rounded-[2rem] bg-white p-6 shadow-card">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-mint px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-brand-ink">
          <ShieldCheck className="h-4 w-4" />
          Ultimo paso
        </div>
        <h2 className="font-display text-2xl text-brand-ink md:text-3xl">Subi tu comprobante</h2>
        <p className="text-sm leading-6 text-brand-ink/70">
          Cuando ya pagaste, subi el comprobante para avisarnos y continuar con tu pedido.
        </p>
      </div>

      <div className="grid gap-4">
        <Input
          inputMode="numeric"
          placeholder="DNI del titular que transfirio"
          {...form.register("transferSenderName")}
        />
      </div>

      <div className="rounded-[1.75rem] border border-dashed border-brand-pink/30 bg-[linear-gradient(180deg,rgba(255,247,248,0.95)_0%,rgba(255,255,255,1)_100%)] p-4">
        <label className="block cursor-pointer">
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <div className="rounded-[1.5rem] border border-white bg-white p-5 shadow-[0_10px_30px_rgba(44,34,65,0.06)] transition hover:shadow-[0_16px_40px_rgba(44,34,65,0.10)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-pink text-white shadow-soft">
                <Upload className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-extrabold text-brand-ink">Subir comprobante</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-mint px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-ink">
                    <WandSparkles className="h-3.5 w-3.5" />
                    Facil
                  </span>
                </div>
                <p className="mt-1 text-sm text-brand-ink/65">
                  Toca aca para elegir una foto o PDF desde tu celular.
                </p>
                <div className="mt-4 inline-flex rounded-full bg-brand-pink px-4 py-2 text-sm font-bold text-white">
                  Elegir foto o PDF
                </div>
                <p className="mt-3 text-xs text-brand-ink/55">Aceptamos JPG, PNG y PDF de hasta 8 MB.</p>
              </div>
            </div>
          </div>
        </label>
      </div>

      {file ? (
        <div className="space-y-3 rounded-[1.5rem] bg-background p-4">
          <div className="flex items-center gap-3">
            {file.type === "application/pdf" ? (
              <FileText className="h-5 w-5 text-brand-pink" />
            ) : (
              <ImageIcon className="h-5 w-5 text-brand-pink" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-brand-ink">{file.name}</p>
              <p className="text-xs text-brand-ink/60">{Math.round(file.size / 1024)} KB</p>
            </div>
          </div>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Vista previa del comprobante"
              className="max-h-72 w-full rounded-2xl bg-white object-contain"
            />
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}

      <Button
        type="button"
        className="w-full"
        disabled={!file || isPending}
        onClick={form.handleSubmit((values) => {
          if (!file) {
            return;
          }

          setError(null);
          startTransition(async () => {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("transferSenderName", values.transferSenderName);

            const response = await fetch(`/api/orders/${orderNumber}/proof`, {
              method: "POST",
              body: formData,
            });

            const payload = await response.json();

            if (!response.ok) {
              setError(payload.error ?? "No pudimos subir el comprobante.");
              return;
            }

            clearCart();
            router.push(`/checkout/confirmacion/${orderNumber}`);
          });
        })}
      >
        {isPending ? "Subiendo comprobante..." : "Ya transferi, enviar comprobante"}
      </Button>

      <p className="text-center text-xs text-brand-ink/55">
        Cuando lo recibamos, tu pago queda en revision y operaciones puede ver el archivo enseguida.
      </p>
    </div>
  );
}
