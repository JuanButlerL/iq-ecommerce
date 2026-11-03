"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ARGENTINA_PROVINCES } from "@/features/wholesale/content";
import { TAX_CONDITION_LABELS } from "@/features/wholesale/tax-condition";
import { event as trackMetaEvent } from "@/lib/pixel";
import { cn } from "@/lib/utils/cn";
import { isValidCuit } from "@/lib/utils/cuit";
import { TAX_CONDITIONS } from "@/lib/validations/wholesale-customer";

type WholesaleRegistrationFormProps = {
  businessTypes: string[];
  monthlyVolumes: string[];
};

const submitClass =
  "mt-2 inline-flex h-14 w-full items-center justify-center rounded-full bg-brand-pink px-6 text-base font-extrabold text-white shadow-soft transition hover:bg-[#ea737d] disabled:cursor-not-allowed disabled:bg-brand-ink/10 disabled:text-brand-ink/40 disabled:shadow-none";

function onlyDigits(value: string) {
  return value.replace(/[^0-9]/g, "").slice(0, 11);
}

function Field({ label, htmlFor, children, hint }: { label: ReactNode; htmlFor: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-bold text-brand-ink/70">
        {label}
      </label>
      {children}
      {hint}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="border-t border-brand-ink/10 pt-4 text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-ink/50">{children}</p>;
}

export function WholesaleRegistrationForm({ businessTypes, monthlyVolumes }: WholesaleRegistrationFormProps) {
  const [cuit, setCuit] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cuitHint =
    cuit.length === 0
      ? ""
      : cuit.length < 11
        ? `Faltan ${11 - cuit.length} dígito${11 - cuit.length === 1 ? "" : "s"}`
        : isValidCuit(cuit)
          ? "✓ CUIT completo"
          : "Revisá el CUIT: los números no coinciden";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (!isValidCuit(cuit)) {
      const input = form.elements.namedItem("cuit") as HTMLInputElement | null;
      input?.focus();
      input?.setCustomValidity("Revisá el CUIT: tiene que tener 11 números válidos, sin guiones.");
      input?.reportValidity();
      input?.setCustomValidity("");
      return;
    }
    const data = new FormData(form);
    const payload = {
      ...Object.fromEntries(Array.from(data.entries()).map(([key, value]) => [key, String(value).trim()])),
      cuit,
      consent: data.get("consent") === "on",
    };

    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/mayoristas/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setError(result?.error ?? "No pudimos completar el registro. Probá de nuevo o escribinos por WhatsApp.");
        return;
      }
      if (result?.data?.status === "created") {
        trackMetaEvent("CompleteRegistration", { content_name: "Registro mayorista", status: true });
      }
      setDone(true);
      // Navegación completa para que la tienda lea la cookie del navegador recordado.
      window.location.assign("/mayoristas?bienvenida=1#productos");
    } catch {
      setError("No pudimos completar el registro. Revisá tu conexión o escribinos por WhatsApp.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="relative space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre y apellido *" htmlFor="r-name">
          <Input id="r-name" name="contactName" placeholder="Tu nombre" autoComplete="name" required />
        </Field>
        <Field label="Teléfono / WhatsApp *" htmlFor="r-phone">
          <Input id="r-phone" name="phone" type="tel" placeholder="+54 9 11 ..." autoComplete="tel" required />
        </Field>
        <Field label="Email *" htmlFor="r-email">
          <Input id="r-email" name="email" type="email" placeholder="tu@email.com" autoComplete="email" required />
        </Field>
        <Field label="Tipo de negocio *" htmlFor="r-type">
          <Select id="r-type" name="businessType" required defaultValue="">
            <option value="" disabled>
              Seleccioná una opción
            </option>
            {businessTypes.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </Select>
        </Field>
      </div>

      <SectionLabel>Datos fiscales</SectionLabel>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={
            <>
              CUIT * <span className="font-normal text-brand-ink/45">(11 dígitos, sin guiones)</span>
            </>
          }
          htmlFor="r-cuit"
          hint={
            <span aria-live="polite" className={cn("min-h-4 text-[11px] font-bold", cuit.length === 11 && isValidCuit(cuit) ? "text-emerald-700" : "text-brand-pink")}>
              {cuitHint}
            </span>
          }
        >
          <Input
            id="r-cuit"
            name="cuit"
            inputMode="numeric"
            maxLength={11}
            placeholder="Ej: 20123456789"
            autoComplete="off"
            required
            value={cuit}
            onChange={(event) => setCuit(onlyDigits(event.target.value))}
          />
        </Field>
        <Field label="Condición frente al IVA *" htmlFor="r-tax">
          <Select id="r-tax" name="taxCondition" required defaultValue="">
            <option value="" disabled>
              Seleccioná
            </option>
            {TAX_CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>
                {TAX_CONDITION_LABELS[condition]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Razón social" htmlFor="r-legal">
          <Input id="r-legal" name="legalName" placeholder="Como figura en AFIP" />
        </Field>
        <Field label="Nombre del negocio" htmlFor="r-business">
          <Input id="r-business" name="businessName" placeholder="Ej: Dietética La Hoja" />
        </Field>
      </div>

      <SectionLabel>Dirección de entrega</SectionLabel>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Calle y número *" htmlFor="r-street">
          <Input id="r-street" name="street" placeholder="Ej: Av. Corrientes 1234" autoComplete="address-line1" required />
        </Field>
        <Field label="Piso / Depto / Local" htmlFor="r-floor">
          <Input id="r-floor" name="floor" placeholder="Ej: 2° B, Local 5" autoComplete="address-line2" />
        </Field>
        <Field label="Ciudad / Localidad *" htmlFor="r-city">
          <Input id="r-city" name="city" placeholder="Ej: Buenos Aires" autoComplete="address-level2" required />
        </Field>
        <Field label="Provincia *" htmlFor="r-province">
          <Select id="r-province" name="province" required defaultValue="">
            <option value="" disabled>
              Seleccioná
            </option>
            {ARGENTINA_PROVINCES.map((province) => (
              <option key={province}>{province}</option>
            ))}
          </Select>
        </Field>
        <Field label="Código Postal *" htmlFor="r-cp">
          <Input id="r-cp" name="postalCode" inputMode="numeric" placeholder="Ej: 1043" autoComplete="postal-code" required />
        </Field>
        <Field label="Referencia / Entre calles" htmlFor="r-reference">
          <Input id="r-reference" name="reference" placeholder="Ej: Entre Salta y Jujuy" />
        </Field>
      </div>

      {monthlyVolumes.length > 0 ? (
        <Field label="¿Qué cantidad estimás necesitar por mes?" htmlFor="r-volume">
          <Select id="r-volume" name="monthlyVolume" defaultValue="">
            <option value="" disabled>
              Seleccioná una opción
            </option>
            {monthlyVolumes.map((volume) => (
              <option key={volume}>{volume}</option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="¿Algo más que quieras contarnos?" htmlFor="r-message">
        <Textarea id="r-message" name="message" placeholder="Contanos brevemente tu negocio o cualquier consulta que tengas..." />
      </Field>

      <label className="flex items-start gap-3 text-xs leading-5 text-brand-ink/70">
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 rounded accent-brand-pink" />
        <span>
          Acepto que iQ Kids use estos datos para gestionar mi cuenta y mis pedidos mayoristas, según la{" "}
          <Link href="/privacidad" className="font-bold text-brand-pink underline-offset-2 hover:underline">
            política de privacidad
          </Link>
          .
        </span>
      </label>

      {/* Campo trampa para bots: oculto para personas y lectores de pantalla. */}
      <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
        <label>
          Sitio web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <button type="submit" className={submitClass} disabled={sending || done}>
        {done ? "¡Listo! Te llevamos a la tienda…" : sending ? "Registrando…" : "Registrarme y hacer mi pedido →"}
      </button>
      {error ? (
        <p role="alert" className="text-center text-sm font-bold text-red-600">
          {error}
        </p>
      ) : null}
    </form>
  );
}
