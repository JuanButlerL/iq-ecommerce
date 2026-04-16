"use client";

import type { ReactNode } from "react";
import { Check, Copy, FileText, ImageIcon, UploadCloud } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/features/cart/store";
import { cn } from "@/lib/utils/cn";
import { paymentProofFormSchema, type PaymentProofFormInput } from "@/lib/validations/proof";

type PaymentProofFormProps = {
  orderNumber: string;
  amount: string;
  alias: string;
};

type RowCardProps = {
  label: string;
  value: string;
  copyable?: boolean;
  children?: ReactNode;
};

function RowCard({ label, value, copyable = false, children }: RowCardProps) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-[1.25rem] border border-brand-ink/8 bg-white px-4 py-3 shadow-[0_8px_22px_rgba(44,34,65,0.04)]">
      <div className="flex items-center gap-3">
        <p className="shrink-0 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink/42 md:text-sm">{label}</p>
        <div className="min-w-0 flex-1">
          {children ? (
            children
          ) : (
            <p className="truncate text-right text-base font-bold text-brand-ink md:text-lg">{value}</p>
          )}
        </div>
        {copyable ? (
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-brand-pink transition hover:bg-brand-pink/6"
            aria-label={`Copiar ${label}`}
            onClick={async () => {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PaymentProofForm({ orderNumber, amount, alias }: PaymentProofFormProps) {
  const router = useRouter();
  const clearCart = useCartStore((state) => state.clear);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
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

  const handleFileChange = (nextFile: File | null) => {
    setFile(nextFile);
    setFileError(null);
  };

  const submitProof = form.handleSubmit(
    (values) => {
      if (!file) {
        setFileError("Subi el comprobante para continuar.");
        return;
      }

      setError(null);
      setFileError(null);
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
    },
    () => {
      if (!file) {
        setFileError("Subi el comprobante para continuar.");
      }
    },
  );

  return (
    <div className="w-full">
      <div className="rounded-[1.8rem] border border-brand-ink/8 bg-white p-4 shadow-[0_18px_44px_rgba(44,34,65,0.06)] sm:p-5 md:p-6">
        <div className="grid gap-4">
          <RowCard label="Monto" value={amount} copyable />
          <RowCard label="Alias" value={alias} copyable />
          <RowCard label="DNI" value="">
            <Input
              id="transferSenderName"
              inputMode="numeric"
              placeholder="Ej: 30123456"
              aria-invalid={form.formState.errors.transferSenderName ? "true" : "false"}
              className={cn(
                "h-auto border-0 bg-transparent px-0 py-0 text-right text-base font-bold text-brand-ink placeholder:text-brand-ink/36 focus:ring-0 md:text-lg",
                form.formState.errors.transferSenderName ? "text-red-700" : "",
              )}
              {...form.register("transferSenderName")}
            />
          </RowCard>

          <label className="block cursor-pointer rounded-[1.25rem] border border-dashed border-brand-pink/25 bg-[#fffafa] px-4 py-3">
            <div className="flex items-center gap-3">
              <p className="shrink-0 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink/42 md:text-sm">
                Subir comprobante
              </p>
              <div className="min-w-0 flex-1">
                {file ? <p className="truncate text-right text-sm font-medium text-brand-ink/78">{file.name}</p> : null}
              </div>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-pink text-white shadow-[0_8px_18px_rgba(244,137,145,0.16)] transition hover:bg-[#ea737d]">
                <UploadCloud className="h-4 w-4" />
              </span>
            </div>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="sr-only"
              onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
            />
          </label>

          {file ? (
            <div className="overflow-hidden rounded-[1.2rem] border border-brand-ink/8 bg-[#fcfcfc] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-pink/10 text-brand-pink">
                  {file.type === "application/pdf" ? <FileText className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-brand-ink">{file.name}</p>
                  <p className="text-xs text-brand-ink/55">{Math.round(file.size / 1024)} KB</p>
                </div>
              </div>
              {previewUrl ? (
                <div className="mt-3 rounded-[1.2rem] border border-brand-ink/8 bg-[#fafafa] p-2">
                  <img
                    src={previewUrl}
                    alt="Vista previa del comprobante"
                    className="max-h-56 w-full rounded-xl object-contain"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {form.formState.errors.transferSenderName ? (
            <p className="text-sm font-bold text-red-600">Ingresa un DNI valido.</p>
          ) : null}
          {fileError ? <p className="text-sm font-bold text-red-600">{fileError}</p> : null}
          {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
        </div>
      </div>

      <Button
        type="button"
        size="lg"
        className="mx-auto mt-6 flex h-14 w-full max-w-[20rem] rounded-full bg-[#00a650] px-8 text-sm font-extrabold uppercase tracking-[0.04em] text-white shadow-[0_14px_30px_rgba(0,166,80,0.18)] hover:bg-[#00904a]"
        disabled={isPending}
        onClick={submitProof}
      >
        {isPending ? "Subiendo..." : "Finalizar"}
      </Button>
    </div>
  );
}
