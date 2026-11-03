"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type WholesaleSettingsFormProps = {
  settings: {
    minDisplays: number;
    enableMercadoPago: boolean;
    enableBankTransfer: boolean;
    enableEcheq: boolean;
    echeqMaxDays: number;
    echeqInstructions: string | null;
    enableBankTransferDiscount: boolean;
    bankTransferDiscountPercentage: number;
    freeShippingThresholdArs: number | null;
    orderNotificationEmails: string[];
  };
  bankAccount: { alias: string; cbu: string; holder: string } | null;
};

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <div className="border-b border-brand-ink/10 p-5 md:p-6">
        <p className="font-display text-2xl leading-none text-brand-ink">{title}</p>
        {description ? <p className="mt-1.5 text-sm text-brand-ink/60">{description}</p> : null}
      </div>
      <div className="space-y-4 p-5 md:p-6">{children}</div>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="grid content-start gap-1.5 text-sm font-bold text-brand-ink">
      {label}
      {children}
      {hint ? <span className="text-xs font-normal text-brand-ink/50">{hint}</span> : null}
    </label>
  );
}

export function WholesaleSettingsForm({ settings, bankAccount }: WholesaleSettingsFormProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    minDisplays: String(settings.minDisplays),
    enableMercadoPago: settings.enableMercadoPago,
    enableBankTransfer: settings.enableBankTransfer,
    enableEcheq: settings.enableEcheq,
    echeqMaxDays: String(settings.echeqMaxDays),
    echeqInstructions: settings.echeqInstructions ?? "",
    enableBankTransferDiscount: settings.enableBankTransferDiscount,
    bankTransferDiscountPercentage: String(settings.bankTransferDiscountPercentage),
    freeShippingThresholdArs: settings.freeShippingThresholdArs ? String(settings.freeShippingThresholdArs) : "",
    orderNotificationEmails: settings.orderNotificationEmails.join("\n"),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/wholesale-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minDisplays: Number.parseInt(values.minDisplays, 10) || 0,
          enableMercadoPago: values.enableMercadoPago,
          enableBankTransfer: values.enableBankTransfer,
          enableEcheq: values.enableEcheq,
          echeqMaxDays: Number.parseInt(values.echeqMaxDays, 10) || 0,
          echeqInstructions: values.echeqInstructions,
          enableBankTransferDiscount: values.enableBankTransferDiscount,
          bankTransferDiscountPercentage: Number(values.bankTransferDiscountPercentage.replace(",", ".")) || 0,
          freeShippingThresholdArs: values.freeShippingThresholdArs.trim() ? Number.parseInt(values.freeShippingThresholdArs, 10) || 0 : null,
          orderNotificationEmails: values.orderNotificationEmails
            .split(/[\n,;]/)
            .map((email) => email.trim())
            .filter(Boolean),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No pudimos guardar las condiciones.");
        return;
      }
      setMessage("Condiciones guardadas.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="space-y-6 pb-28"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Mayorista</p>
        <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Condiciones</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/70 md:text-base">
          Reglas de compra del canal mayorista. El pago posterior a la entrega y el descuento especial se habilitan por cliente en{" "}
          <Link href="/admin/mayoristas/clientes" className="font-bold text-brand-pink hover:underline">
            Clientes
          </Link>
          .
        </p>
      </div>

      <Section title="Pedido mínimo">
        <Field label="Mínimo de displays por pedido" hint="Se cuentan todos los productos juntos: se pueden mezclar sabores para llegar al mínimo.">
          <Input type="number" inputMode="numeric" min={1} step={1} value={values.minDisplays} onChange={(event) => set("minDisplays", event.target.value)} className="max-w-[200px]" />
        </Field>
      </Section>

      <Section
        title="Medios de pago"
        description={
          bankAccount ? (
            <>
              La transferencia usa la cuenta de Configuración ({bankAccount.alias || bankAccount.cbu} · {bankAccount.holder}).
            </>
          ) : (
            "La transferencia usa la cuenta bancaria de Configuración."
          )
        }
      >
        <Checkbox label="Mercado Pago" checked={values.enableMercadoPago} onChange={(event) => set("enableMercadoPago", event.target.checked)} />
        <Checkbox label="Transferencia bancaria" checked={values.enableBankTransfer} onChange={(event) => set("enableBankTransfer", event.target.checked)} />
        <Checkbox label="eCheq" checked={values.enableEcheq} onChange={(event) => set("enableEcheq", event.target.checked)} />
        {values.enableEcheq ? (
          <div className="grid gap-4 rounded-3xl bg-[#fff6f7] p-4 md:grid-cols-[200px_1fr]">
            <Field label="Plazo máximo (días)">
              <Input type="number" inputMode="numeric" min={0} step={1} value={values.echeqMaxDays} onChange={(event) => set("echeqMaxDays", event.target.value)} />
            </Field>
            <Field label="Comentario que ve el cliente al elegir eCheq">
              <Textarea value={values.echeqInstructions} onChange={(event) => set("echeqInstructions", event.target.value)} className="min-h-20" />
            </Field>
          </div>
        ) : null}
      </Section>

      <Section title="Descuento por transferencia" description="Independiente del descuento por transferencia de la tienda.">
        <Checkbox
          label="Aplicar descuento a los pedidos mayoristas pagados por transferencia"
          checked={values.enableBankTransferDiscount}
          onChange={(event) => set("enableBankTransferDiscount", event.target.checked)}
        />
        {values.enableBankTransferDiscount ? (
          <Field label="Descuento (%)">
            <Input
              inputMode="decimal"
              value={values.bankTransferDiscountPercentage}
              onChange={(event) => set("bankTransferDiscountPercentage", event.target.value)}
              className="max-w-[200px]"
            />
          </Field>
        ) : null}
      </Section>

      <Section
        title="Envío"
        description={
          <>
            Los costos por provincia están en{" "}
            <Link href="/admin/mayoristas/envios" className="font-bold text-brand-pink hover:underline">
              Envíos mayoristas
            </Link>
            .
          </>
        }
      >
        <Field label="Envío gratis desde (ARS)" hint="Vacío = los pedidos mayoristas siempre pagan envío.">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={values.freeShippingThresholdArs}
            onChange={(event) => set("freeShippingThresholdArs", event.target.value)}
            className="max-w-[240px]"
          />
        </Field>
      </Section>

      <Section title="Avisos de pedidos">
        <Field label="Emails que reciben el aviso de cada pedido mayorista" hint="Uno por renglón (hasta 5).">
          <Textarea value={values.orderNotificationEmails} onChange={(event) => set("orderNotificationEmails", event.target.value)} className="min-h-24" />
        </Field>
      </Section>

      <Card className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 p-4 ring-1 ring-brand-ink/5">
        <div className="min-w-0 text-sm">
          {error ? <p className="font-bold text-red-600">{error}</p> : message ? <p className="font-bold text-emerald-700">{message}</p> : null}
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Guardar condiciones
        </Button>
      </Card>
    </form>
  );
}
