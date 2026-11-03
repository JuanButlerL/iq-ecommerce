"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { ShoppingCart } from "lucide-react";

import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ARGENTINA_PROVINCES, type WholesaleContent } from "@/features/wholesale/content";
import { cn } from "@/lib/utils/cn";
import { buildWhatsappUrl } from "@/lib/utils/whatsapp";

type WholesaleContactProps = {
  whatsappNumber: string;
  content: WholesaleContent["contact"];
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

function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-brand-ink/50">
      <span className="h-px flex-1 bg-brand-ink/10" />
      {children}
      <span className="h-px flex-1 bg-brand-ink/10" />
    </div>
  );
}

export function WholesaleContact({ whatsappNumber, content }: WholesaleContactProps) {
  const [cuit, setCuit] = useState("");
  const [leadSent, setLeadSent] = useState(false);
  const [leadSending, setLeadSending] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  const rejectCuit = (form: HTMLFormElement, name: string, message: string) => {
    const input = form.elements.namedItem(name) as HTMLInputElement | null;
    if (!input) return;
    input.focus();
    input.setCustomValidity(message);
    input.reportValidity();
    input.setCustomValidity("");
  };

  const handleLeadSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (cuit && cuit.length !== 11) {
      rejectCuit(form, "cuit", "El CUIT debe tener exactamente 11 dígitos (sin guiones).");
      return;
    }
    const data = new FormData(form);
    const payload = {
      ...Object.fromEntries(Array.from(data.entries()).map(([key, value]) => [key, String(value).trim()])),
      cuit,
      consentimiento: data.get("consentimiento") === "on",
    };

    setLeadSending(true);
    setLeadError(null);
    try {
      const response = await fetch("/api/mayoristas/consultas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setLeadError(result?.error ?? "No pudimos enviar tu consulta. Probá de nuevo o escribinos por WhatsApp.");
        return;
      }
      setLeadSent(true);
      form.reset();
      setCuit("");
    } catch {
      setLeadError("No pudimos enviar tu consulta. Revisá tu conexión o escribinos por WhatsApp.");
    } finally {
      setLeadSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-[680px]">
      <div className="rounded-[2rem] bg-white p-5 shadow-card sm:p-10">
        <h3 className="font-display text-3xl leading-none text-brand-ink">{content.leadTitle}</h3>
        {content.leadDescription ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-brand-ink/60">{content.leadDescription}</p> : null}
        <form noValidate onSubmit={handleLeadSubmit} className="relative mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre *" htmlFor="l-nombre">
              <Input id="l-nombre" name="nombre" placeholder="Tu nombre" autoComplete="name" required />
            </Field>
            <Field label="Teléfono / WhatsApp *" htmlFor="l-tel">
              <Input id="l-tel" name="telefono" type="tel" placeholder="+54 9 11 ..." autoComplete="tel" required />
            </Field>
            <Field label="Email *" htmlFor="l-email">
              <Input id="l-email" name="email" type="email" placeholder="tu@email.com" autoComplete="email" required />
            </Field>
            <Field label="Nombre del negocio" htmlFor="l-negocio">
              <Input id="l-negocio" name="negocio" placeholder="Ej: Dietética La Hoja" />
            </Field>
            <Field label="Tipo de negocio *" htmlFor="l-tipo">
              <Select id="l-tipo" name="tipo" required defaultValue="">
                <option value="" disabled>
                  Seleccioná una opción
                </option>
                {content.businessTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </Select>
            </Field>
            <Field
              label={
                <>
                  CUIT <span className="font-normal text-brand-ink/45">(11 dígitos, sin guiones)</span>
                </>
              }
              htmlFor="l-cuit"
              hint={
                <span aria-live="polite" className={cn("min-h-4 text-[11px] font-bold", cuit.length === 11 ? "text-emerald-700" : "text-brand-pink")}>
                  {cuit.length === 0 ? "" : cuit.length === 11 ? "✓ CUIT completo" : `Faltan ${11 - cuit.length} dígito${11 - cuit.length === 1 ? "" : "s"}`}
                </span>
              }
            >
              <Input id="l-cuit" name="cuit" inputMode="numeric" maxLength={11} placeholder="Ej: 20123456789" autoComplete="off" value={cuit} onChange={(event) => setCuit(onlyDigits(event.target.value))} />
            </Field>
          </div>

          <p className="border-t border-brand-ink/10 pt-4 text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-ink/50">Dirección de entrega</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Calle y número *" htmlFor="l-calle">
              <Input id="l-calle" name="calle" placeholder="Ej: Av. Corrientes 1234" required />
            </Field>
            <Field label="Piso / Depto / Local" htmlFor="l-piso">
              <Input id="l-piso" name="piso" placeholder="Ej: 2° B, Local 5" />
            </Field>
            <Field label="Ciudad / Localidad *" htmlFor="l-ciudad">
              <Input id="l-ciudad" name="ciudad" placeholder="Ej: Buenos Aires" required />
            </Field>
            <Field label="Provincia *" htmlFor="l-provincia">
              <Select id="l-provincia" name="provincia" required defaultValue="">
                <option value="" disabled>
                  Seleccioná
                </option>
                {ARGENTINA_PROVINCES.map((province) => (
                  <option key={province}>{province}</option>
                ))}
              </Select>
            </Field>
            <Field label="Código Postal *" htmlFor="l-cp">
              <Input id="l-cp" name="cp" inputMode="numeric" placeholder="Ej: 1043" required />
            </Field>
            <Field label="Referencia / Entre calles" htmlFor="l-zona">
              <Input id="l-zona" name="zona" placeholder="Ej: Entre Salta y Jujuy" />
            </Field>
          </div>

          {content.monthlyVolumes.length > 0 ? (
            <Field label="¿Qué cantidad estimás necesitar por mes?" htmlFor="l-cant">
              <Select id="l-cant" name="cantidad" defaultValue="">
                <option value="" disabled>
                  Seleccioná una opción
                </option>
                {content.monthlyVolumes.map((volume) => (
                  <option key={volume}>{volume}</option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="¿Algo más que quieras contarnos?" htmlFor="l-msg">
            <Textarea id="l-msg" name="mensaje" placeholder="Contanos brevemente tu negocio o cualquier consulta que tengas..." />
          </Field>

          <label className="flex items-start gap-3 text-xs leading-5 text-brand-ink/70">
            <input type="checkbox" name="consentimiento" required className="mt-0.5 h-4 w-4 shrink-0 rounded accent-brand-pink" />
            <span>
              Acepto que iQ Kids use estos datos para contactarme por esta consulta, según la{" "}
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

          <button type="submit" className={cn(submitClass, leadSent && "disabled:bg-brand-mint disabled:text-brand-ink")} disabled={leadSent || leadSending}>
            {leadSent ? "¡Recibimos tu consulta! Te respondemos en menos de 24 horas" : leadSending ? "Enviando…" : "Enviar consulta →"}
          </button>
          {leadError ? (
            <p role="alert" className="text-center text-sm font-bold text-red-600">
              {leadError}
            </p>
          ) : null}
        </form>

        <Divider>o si ya sabés lo que querés</Divider>
        <a
          href="#productos"
          className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-brand-pink bg-[#fff6f7] px-4 py-3.5 text-sm font-extrabold text-brand-ink transition hover:bg-brand-pinkSoft/50"
        >
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          Ver precios y hacer el pedido online
        </a>
        <p className="mt-2 text-center text-xs text-brand-ink/50">Elegís los displays, pagás y listo.</p>

        <Divider>o contactanos directo</Divider>
        <a
          href={buildWhatsappUrl(whatsappNumber, "Hola! Me interesa vender iQ Kids en mi negocio.")}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-3.5 text-sm font-extrabold text-white transition hover:brightness-95"
        >
          <WhatsappIcon className="h-5 w-5" />
          Escribinos por WhatsApp
        </a>
        <p className="mt-3 text-center text-xs text-brand-ink/50">Te respondemos en menos de 24 horas · Sin compromiso de compra</p>
      </div>
    </div>
  );
}
