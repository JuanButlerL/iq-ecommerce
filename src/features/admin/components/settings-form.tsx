"use client";

import { ShippingMode, type ShippingRule, type StoreSettings } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SettingsFormProps = {
  settings: StoreSettings;
  shippingRules: ShippingRule[];
};

export function SettingsForm({ settings, shippingRules }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    ...settings,
    instagramUrl: settings.instagramUrl ?? "",
    checkoutMessage: settings.checkoutMessage ?? "",
    transferInstructions: settings.transferInstructions ?? "",
    mercadoPagoCheckoutLabel: settings.mercadoPagoCheckoutLabel ?? "",
    institutionalBanner: settings.institutionalBanner ?? "",
    purchaseSuccessMessage: settings.purchaseSuccessMessage ?? "",
    activeShippingRuleId: settings.activeShippingRuleId ?? "",
  });

  return (
    <Card className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="font-display text-3xl text-brand-ink md:text-4xl">Configuración de tienda</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre de la tienda">
          <Input value={form.storeName} onChange={(event) => setForm((current) => ({ ...current, storeName: event.target.value }))} placeholder="IQ Kids" />
        </Field>
        <Field label="WhatsApp de contacto">
          <Input value={form.whatsappNumber} onChange={(event) => setForm((current) => ({ ...current, whatsappNumber: event.target.value }))} placeholder="54911..." />
        </Field>
        <Field label="URL de Instagram">
          <Input value={form.instagramUrl} onChange={(event) => setForm((current) => ({ ...current, instagramUrl: event.target.value }))} placeholder="https://instagram.com/..." />
        </Field>
        <Field label="Email de contacto">
          <Input value={form.contactEmail} onChange={(event) => setForm((current) => ({ ...current, contactEmail: event.target.value }))} placeholder="hola@iqkids.com.ar" />
        </Field>
        <Field label="Alias bancario">
          <Input value={form.bankAlias} onChange={(event) => setForm((current) => ({ ...current, bankAlias: event.target.value }))} placeholder="Alias para transferencias" />
        </Field>
        <Field label="CBU">
          <Input value={form.bankCbu} onChange={(event) => setForm((current) => ({ ...current, bankCbu: event.target.value }))} placeholder="22 digitos del CBU" />
        </Field>
        <Field label="Banco">
          <Input value={form.bankName} onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))} placeholder="Nombre del banco" />
        </Field>
        <Field label="Titular de la cuenta">
          <Input value={form.bankHolder} onChange={(event) => setForm((current) => ({ ...current, bankHolder: event.target.value }))} placeholder="Nombre del titular" />
        </Field>
        <Field label="CUIT del titular">
          <Input value={form.bankTaxId} onChange={(event) => setForm((current) => ({ ...current, bankTaxId: event.target.value }))} placeholder="CUIT del titular" />
        </Field>
        <Field label="Monto minimo de compra">
          <Input type="number" value={form.minimumOrderAmount} onChange={(event) => setForm((current) => ({ ...current, minimumOrderAmount: Number(event.target.value) }))} placeholder="20000" />
        </Field>
        <Field label="Envío gratis desde">
          <Input type="number" value={form.freeShippingThreshold} onChange={(event) => setForm((current) => ({ ...current, freeShippingThreshold: Number(event.target.value) }))} placeholder="60000" />
        </Field>
        <Field label="Costo fijo de envío nacional">
          <Input type="number" value={form.flatShippingPrice} onChange={(event) => setForm((current) => ({ ...current, flatShippingPrice: Number(event.target.value) }))} placeholder="Costo en ARS" />
        </Field>
        <Field label="Modo de envío">
          <Select value={form.shippingMode} onChange={(event) => setForm((current) => ({ ...current, shippingMode: event.target.value as ShippingMode }))}>
            {Object.values(ShippingMode).map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Regla activa de envío">
          <Select value={form.activeShippingRuleId} onChange={(event) => setForm((current) => ({ ...current, activeShippingRuleId: event.target.value }))}>
            <option value="">Sin regla</option>
            {shippingRules.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {rule.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Horas de reserva del pedido">
          <Input type="number" value={form.orderReservationHours ?? 24} onChange={(event) => setForm((current) => ({ ...current, orderReservationHours: Number(event.target.value) }))} placeholder="24" />
        </Field>
        <div className="flex flex-col gap-3 md:col-span-2 sm:flex-row sm:flex-wrap sm:gap-4">
          <Checkbox label="Solicitar DNI / CUIT" checked={form.requireTaxId} onChange={(event) => setForm((current) => ({ ...current, requireTaxId: event.target.checked }))} />
          <Checkbox label="WhatsApp flotante" checked={form.showFloatingWhatsapp} onChange={(event) => setForm((current) => ({ ...current, showFloatingWhatsapp: event.target.checked }))} />
          <Checkbox label="Tienda abierta" checked={form.isStoreOpen} onChange={(event) => setForm((current) => ({ ...current, isStoreOpen: event.target.checked }))} />
        </div>
        <Field label="Mensaje del checkout" className="md:col-span-2">
          <Textarea value={form.checkoutMessage} onChange={(event) => setForm((current) => ({ ...current, checkoutMessage: event.target.value }))} placeholder="Texto que ve el usuario al iniciar la compra" />
        </Field>
        <Field label="Instrucciones de transferencia" className="md:col-span-2">
          <Textarea value={form.transferInstructions} onChange={(event) => setForm((current) => ({ ...current, transferInstructions: event.target.value }))} placeholder="Pasos para transferir y subir comprobante" />
        </Field>
        <Field label="Texto de Mercado Pago" className="md:col-span-2">
          <Input value={form.mercadoPagoCheckoutLabel} onChange={(event) => setForm((current) => ({ ...current, mercadoPagoCheckoutLabel: event.target.value }))} placeholder="Texto corto para explicar Mercado Pago en checkout" />
        </Field>
        <Field label="Texto institucional destacado" className="md:col-span-2">
          <Input value={form.institutionalBanner} onChange={(event) => setForm((current) => ({ ...current, institutionalBanner: event.target.value }))} placeholder="Texto corto de marca o banner institucional" />
        </Field>
        <Field label="Mensaje luego de compra confirmada" className="md:col-span-2">
          <Textarea value={form.purchaseSuccessMessage} onChange={(event) => setForm((current) => ({ ...current, purchaseSuccessMessage: event.target.value }))} placeholder="Mensaje final para la pantalla de confirmacion" />
        </Field>
      </div>
      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
      <Button
        type="button"
        disabled={isPending}
        className="w-full sm:w-auto"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const response = await fetch("/api/admin/settings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(form),
            });
            const payload = await response.json();

            if (!response.ok) {
              setError(payload.error ?? "No pudimos guardar la configuración.");
              return;
            }

            router.refresh();
          });
        }}
      >
        {isPending ? "Guardando..." : "Guardar configuración"}
      </Button>
    </Card>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-2 block text-sm font-bold text-brand-ink/75">{label}</span>
      {children}
    </label>
  );
}
