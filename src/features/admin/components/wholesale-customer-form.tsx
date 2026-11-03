"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TAX_CONDITION_LABELS, getInvoiceType } from "@/features/wholesale/tax-condition";
import { ARGENTINA_PROVINCES } from "@/lib/constants/provinces";
import { formatCuit } from "@/lib/utils/cuit";
import type { WholesaleCustomerFormValues } from "@/features/wholesale/customer-form-values";
import type { TAX_CONDITIONS } from "@/lib/validations/wholesale-customer";

type TaxConditionValue = (typeof TAX_CONDITIONS)[number];

type WholesaleCustomerFormProps = {
  customerId?: string;
  leadId?: string | null;
  initialValues: WholesaleCustomerFormValues;
  businessTypes: string[];
  otherCuits?: { id: string; cuit: string; label: string }[];
  meta?: ReactNode;
};

function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`grid content-start gap-1.5 text-sm font-bold text-brand-ink ${className ?? ""}`}>
      {label}
      {children}
      {hint ? <span className="text-xs font-normal text-brand-ink/50">{hint}</span> : null}
    </label>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <div className="border-b border-brand-ink/10 p-5 md:p-6">
        <p className="font-display text-2xl leading-none text-brand-ink">{title}</p>
        {description ? <p className="mt-1.5 text-sm text-brand-ink/60">{description}</p> : null}
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2 md:p-6">{children}</div>
    </Card>
  );
}

export function WholesaleCustomerForm({ customerId, leadId, initialValues, businessTypes, otherCuits = [], meta }: WholesaleCustomerFormProps) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const invoiceType = getInvoiceType(values.taxCondition || null);
  const typeOptions = values.businessType && !businessTypes.includes(values.businessType) ? [...businessTypes, values.businessType] : businessTypes;

  function set<K extends keyof WholesaleCustomerFormValues>(key: K, value: WholesaleCustomerFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(customerId ? `/api/admin/wholesale-customers/${customerId}` : "/api/admin/wholesale-customers", {
        method: customerId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          taxCondition: values.taxCondition || null,
          extraDiscountPercentage: Number(values.extraDiscountPercentage.replace(",", ".")) || 0,
          leadId: leadId ?? null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "No pudimos guardar el cliente.");
        return;
      }
      if (customerId) {
        setMessage("Cliente guardado.");
        router.refresh();
      } else {
        router.push(`/admin/mayoristas/clientes/${payload.data.id}`);
      }
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
      {meta}

      <Section title="Negocio y facturación">
        <Field label="CUIT" hint={values.cuit.replace(/\D/g, "").length === 11 ? formatCuit(values.cuit) : "11 números, con o sin guiones."}>
          <Input value={values.cuit} inputMode="numeric" onChange={(event) => set("cuit", event.target.value)} required />
        </Field>
        <Field label="Condición frente al IVA" hint={invoiceType ? `Corresponde factura ${invoiceType}.` : "Define si va factura A o B."}>
          <Select value={values.taxCondition} onChange={(event) => set("taxCondition", event.target.value as TaxConditionValue | "")}>
            <option value="">Sin informar</option>
            {(Object.keys(TAX_CONDITION_LABELS) as TaxConditionValue[]).map((value) => (
              <option key={value} value={value}>
                {TAX_CONDITION_LABELS[value]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Razón social">
          <Input value={values.legalName} onChange={(event) => set("legalName", event.target.value)} />
        </Field>
        <Field label="Nombre del negocio">
          <Input value={values.businessName} onChange={(event) => set("businessName", event.target.value)} />
        </Field>
        <Field label="Tipo de negocio">
          <Select value={values.businessType} onChange={(event) => set("businessType", event.target.value)}>
            <option value="">Sin informar</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <Section
        title="Contacto"
        description="Con este email se identifica en el checkout mayorista. Si el mismo email tiene varios CUIT, elige con cuál compra."
      >
        <Field label="Nombre de contacto">
          <Input value={values.contactName} onChange={(event) => set("contactName", event.target.value)} required />
        </Field>
        <Field label="Email">
          <Input type="email" value={values.email} onChange={(event) => set("email", event.target.value)} required />
        </Field>
        <Field label="Teléfono / WhatsApp">
          <Input type="tel" value={values.phone} onChange={(event) => set("phone", event.target.value)} required />
        </Field>
        {otherCuits.length > 0 ? (
          <div className="text-sm md:col-span-2">
            <p className="font-bold text-brand-ink">Otros CUIT con este email</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {otherCuits.map((other) => (
                <li key={other.id}>
                  <Link href={`/admin/mayoristas/clientes/${other.id}`} className="inline-flex rounded-full bg-[#fff6f7] px-3 py-1 text-xs font-bold text-brand-ink hover:text-brand-pink">
                    {formatCuit(other.cuit)} · {other.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section title="Entrega" description="Se precarga en el checkout; el cliente la puede editar para cada pedido.">
        <Field label="Calle y número">
          <Input value={values.street} onChange={(event) => set("street", event.target.value)} required />
        </Field>
        <Field label="Piso / Depto / Local">
          <Input value={values.floor} onChange={(event) => set("floor", event.target.value)} />
        </Field>
        <Field label="Ciudad / Localidad">
          <Input value={values.city} onChange={(event) => set("city", event.target.value)} required />
        </Field>
        <Field label="Provincia">
          <Select value={values.province} onChange={(event) => set("province", event.target.value)} required>
            <option value="">Elegí la provincia</option>
            {ARGENTINA_PROVINCES.map((province) => (
              <option key={province.code} value={province.name}>
                {province.name}
              </option>
            ))}
            {values.province && !ARGENTINA_PROVINCES.some((province) => province.name === values.province) ? (
              <option value={values.province}>{values.province}</option>
            ) : null}
          </Select>
        </Field>
        <Field label="Código postal">
          <Input value={values.postalCode} onChange={(event) => set("postalCode", event.target.value)} required />
        </Field>
        <Field label="Referencia">
          <Input value={values.reference} onChange={(event) => set("reference", event.target.value)} placeholder="Entre calles, horario de recepción..." />
        </Field>
      </Section>

      <Section title="Condiciones comerciales">
        <div className="space-y-2 md:col-span-2">
          <Checkbox
            label="Habilitar pago posterior a la entrega y despacho. Solo se ofrece si el pedido va a la dirección de entrega cargada acá."
            checked={values.allowDeferredPayment}
            onChange={(event) => set("allowDeferredPayment", event.target.checked)}
          />
          <Checkbox
            label="Cliente activo. Si lo desactivás, no lo reconocemos en el checkout."
            checked={values.active}
            onChange={(event) => set("active", event.target.checked)}
          />
        </div>
        <Field label="Descuento extra para este CUIT (%)" hint="Se suma a los precios mayoristas. 0 = sin descuento especial.">
          <Input
            inputMode="decimal"
            value={values.extraDiscountPercentage}
            onChange={(event) => set("extraDiscountPercentage", event.target.value)}
          />
        </Field>
        <Field label="Notas internas" className="md:col-span-2">
          <Textarea value={values.adminNotes} onChange={(event) => set("adminNotes", event.target.value)} className="min-h-24" />
        </Field>
      </Section>

      <Card className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 p-4 ring-1 ring-brand-ink/5">
        <div className="min-w-0 text-sm">
          {error ? <p className="font-bold text-red-600">{error}</p> : message ? <p className="font-bold text-emerald-700">{message}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/mayoristas/clientes" className="inline-flex items-center rounded-full px-4 py-2 text-sm font-bold text-brand-ink/70 hover:text-brand-ink">
            Volver al listado
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {customerId ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
