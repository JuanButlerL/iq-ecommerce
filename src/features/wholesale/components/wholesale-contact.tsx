"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ShoppingCart } from "lucide-react";

import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ARGENTINA_PROVINCES, WHOLESALE_BARS_PER_DISPLAY, type WholesaleContent } from "@/features/wholesale/content";
import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";
import { buildWhatsappUrl } from "@/lib/utils/whatsapp";

type Tab = "nuevo" | "pedido";

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
  const orderItems = content.orderItems.map((item, index) => ({ ...item, id: String(index) }));
  const minDisplays = content.minDisplays;
  const [tab, setTab] = useState<Tab>("nuevo");
  const [cuit, setCuit] = useState("");
  const [leadSent, setLeadSent] = useState(false);
  const [leadSending, setLeadSending] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(content.orderItems.map((_, index) => [String(index), 0])),
  );
  const [orderCuit, setOrderCuit] = useState("");

  useEffect(() => {
    const syncFromHash = () => {
      if (window.location.hash === "#pedido") setTab("pedido");
      if (window.location.hash === "#contacto") setTab("nuevo");
    };
    // Los CTAs de la página apuntan a #contacto o #pedido; el click cubre el caso en que el hash no cambia.
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      const href = anchor?.getAttribute("href");
      if (href === "#pedido") setTab("pedido");
      if (href === "#contacto") setTab("nuevo");
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const displays = orderItems.reduce((sum, item) => sum + (quantities[item.id] ?? 0), 0);
  const total = orderItems.reduce((sum, item) => sum + (quantities[item.id] ?? 0) * item.price, 0);
  const minimumReached = displays >= minDisplays;
  const missing = minDisplays - displays;

  const setQuantity = (id: string, value: number) =>
    setQuantities((current) => ({ ...current, [id]: Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0) }));

  const openWhatsapp = (message: string) => {
    window.open(buildWhatsappUrl(whatsappNumber, message), "_blank", "noopener");
  };

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

  const handleOrderSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (orderCuit && orderCuit.length !== 11) {
      rejectCuit(form, "cuit", "El CUIT debe tener exactamente 11 dígitos.");
      return;
    }
    const data = new FormData(form);
    const business = String(data.get("negocio") ?? "").trim();
    const note = String(data.get("nota") ?? "").trim();
    const items = orderItems.filter((item) => (quantities[item.id] ?? 0) > 0)
      .map((item) => `• ${quantities[item.id]} x ${item.name}`)
      .join("\n");
    const message = [
      "Hola! Quiero hacer un pedido mayorista de iQ Kids.",
      "",
      `Negocio: ${business}${orderCuit ? `\nCUIT: ${orderCuit}` : ""}`,
      "",
      items,
      "",
      `Total estimado: ${formatArs(total)} (IVA incluido)`,
      ...(note ? ["", `Entrega / comentarios: ${note}`] : []),
    ].join("\n");
    openWhatsapp(message);
  };

  const tabClass = (key: Tab) =>
    cn(
      "rounded-full px-3 py-3 text-sm font-extrabold transition",
      tab === key ? "bg-white text-brand-ink shadow-card" : "text-brand-ink/60 hover:text-brand-ink",
    );

  return (
    <div className="mx-auto max-w-[680px]">
      <span id="pedido" className="block scroll-mt-28" aria-hidden="true" />
      <div role="tablist" aria-label="Tipo de contacto" className="mb-4 grid grid-cols-2 gap-1.5 rounded-full bg-brand-pinkSoft/60 p-1.5">
        <button type="button" role="tab" id="tab-nuevo" aria-controls="panel-nuevo" aria-selected={tab === "nuevo"} className={tabClass("nuevo")} onClick={() => setTab("nuevo")}>
          Soy nuevo
        </button>
        <button type="button" role="tab" id="tab-pedido" aria-controls="panel-pedido" aria-selected={tab === "pedido"} className={tabClass("pedido")} onClick={() => setTab("pedido")}>
          Ya soy cliente: hacer pedido
          {content.orderEnabled ? null : (
            <span className="ml-1.5 inline-block rounded-full bg-brand-yellow px-2 py-0.5 align-middle text-[10px] font-extrabold uppercase tracking-[0.08em] text-brand-ink">
              Próximamente
            </span>
          )}
        </button>
      </div>

      <div id="panel-nuevo" role="tabpanel" aria-labelledby="tab-nuevo" hidden={tab !== "nuevo"} className="rounded-[2rem] bg-white p-5 shadow-card sm:p-10">
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

        {content.orderEnabled ? (
          <>
        <Divider>o si preferís autogestionarlo</Divider>
        <a
          href="#pedido"
          className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-brand-pink bg-[#fff6f7] px-4 py-3.5 text-sm font-extrabold text-brand-ink transition hover:bg-brand-pinkSoft/50"
        >
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          Hacer pedido directo sin hablar con nadie
        </a>
        <p className="mt-2 text-center text-xs text-brand-ink/50">Elegís los displays, confirmás por WhatsApp y listo.</p>
          </>
        ) : null}

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

      <div id="panel-pedido" role="tabpanel" aria-labelledby="tab-pedido" hidden={tab !== "pedido"} className="rounded-[2rem] bg-white p-5 shadow-card sm:p-10">
        {content.orderEnabled ? (
          <>
        <h3 className="font-display text-3xl leading-none text-brand-ink">{content.orderTitle}</h3>
        {content.orderDescription ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-brand-ink/60">{content.orderDescription}</p> : null}
        <form noValidate onSubmit={handleOrderSubmit} className="mt-6">
          <div className="space-y-2.5">
            {orderItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-3xl border border-brand-ink/10 px-4 py-3">
                <div>
                  <p className="text-sm font-extrabold text-brand-ink">{item.name}</p>
                  <p className="text-xs tabular-nums text-brand-ink/50">
                    {formatArs(item.price)} · {formatArs(Math.round(item.price / WHOLESALE_BARS_PER_DISPLAY))} por barrita
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={`Quitar un display de ${item.name}`}
                    onClick={() => setQuantity(item.id, (quantities[item.id] ?? 0) - 1)}
                    className="h-9 w-9 rounded-full border border-brand-ink/15 text-lg text-brand-ink transition hover:border-brand-pink hover:text-brand-pink"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    aria-label={`Cantidad de ${item.name}`}
                    value={quantities[item.id] ?? 0}
                    onChange={(event) => setQuantity(item.id, Number.parseInt(event.target.value, 10) || 0)}
                    className="h-9 w-14 rounded-xl border border-brand-ink/15 text-center text-base tabular-nums text-brand-ink outline-none focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
                  />
                  <button
                    type="button"
                    aria-label={`Sumar un display de ${item.name}`}
                    onClick={() => setQuantity(item.id, (quantities[item.id] ?? 0) + 1)}
                    className="h-9 w-9 rounded-full border border-brand-ink/15 text-lg text-brand-ink transition hover:border-brand-pink hover:text-brand-pink"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-baseline justify-between border-t-2 border-brand-ink/10 px-1 pt-4 tabular-nums">
            <span className="text-sm text-brand-ink/70">
              {displays} display{displays === 1 ? "" : "s"} · {displays * WHOLESALE_BARS_PER_DISPLAY} barritas
            </span>
            <strong className="font-display text-3xl font-normal text-brand-ink">{formatArs(total)}</strong>
          </div>
          <p role="status" aria-live="polite" className={cn("mb-4 mt-1 min-h-5 text-xs", !minimumReached && displays > 0 ? "font-bold text-brand-pink" : "text-brand-ink/60")}>
            {minimumReached
              ? "Precios con IVA incluido. El envío se confirma por WhatsApp."
              : displays === 0
                ? `Pedido mínimo: ${minDisplays} display${minDisplays === 1 ? "" : "s"}. Precios con IVA incluido.`
                : `Pedido mínimo: ${minDisplays} display${minDisplays === 1 ? "" : "s"}. ${missing === 1 ? "Te falta 1 display" : `Te faltan ${missing} displays`}.`}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del negocio *" htmlFor="o-negocio">
              <Input id="o-negocio" name="negocio" placeholder="Como figura en tus facturas" required />
            </Field>
            <Field label="CUIT" htmlFor="o-cuit">
              <Input id="o-cuit" name="cuit" inputMode="numeric" placeholder="Para la factura" value={orderCuit} onChange={(event) => setOrderCuit(onlyDigits(event.target.value))} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Dirección de entrega o comentarios" htmlFor="o-nota">
              <Textarea id="o-nota" name="nota" placeholder="Si es la misma de siempre, dejalo vacío" />
            </Field>
          </div>

          <button type="submit" className={cn(submitClass, "mt-4")} disabled={!minimumReached}>
            Enviar pedido por WhatsApp →
          </button>
          <p className="mt-3 text-center text-xs text-brand-ink/50">
            El pedido queda confirmado cuando te respondemos con el total final y la fecha de entrega.
          </p>
        </form>
          </>
        ) : (
          <div className="py-6 text-center">
            <span className="inline-block rounded-full bg-brand-yellow px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink">Próximamente</span>
            <h3 className="mt-4 font-display text-3xl leading-none text-brand-ink">{content.orderTitle}</h3>
            <p className="mx-auto mt-3 max-w-md whitespace-pre-line text-sm leading-6 text-brand-ink/65">{content.orderComingSoonText}</p>
            <a
              href={buildWhatsappUrl(whatsappNumber, "Hola! Ya soy cliente de iQ Kids y quiero hacer un pedido mayorista.")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3.5 text-sm font-extrabold text-white transition hover:brightness-95"
            >
              <WhatsappIcon className="h-5 w-5" />
              Pedir por WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
