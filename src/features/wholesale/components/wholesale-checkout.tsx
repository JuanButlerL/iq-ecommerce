"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { CalendarClock, CheckCircle2, FileCheck2, Landmark, Trash2, type LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { calculateShippingQuote } from "@/features/cart/lib/shipping";
import { AddressMapPreview, buildAddressPreview } from "@/features/checkout/components/address-map-preview";
import { FieldShell } from "@/features/checkout/components/field-shell";
import { PaymentOptionCard } from "@/features/checkout/components/payment-option-card";
import { useHydratedWholesaleCart, useWholesaleCartStore } from "@/features/wholesale/cart-store";
import { joinStreet, splitStreet } from "@/features/wholesale/delivery-address";
import type { WholesaleCustomerProfile } from "@/features/wholesale/identify";
import {
  WHOLESALE_PAYMENT_METHOD_LABELS,
  buildWholesaleShippingSettings,
  calculateWholesalePricing,
  isSameDeliveryAddress,
  type WholesalePaymentMethod,
  type WholesaleShippingRule,
} from "@/features/wholesale/pricing";
import { TAX_CONDITION_LABELS, getInvoiceType } from "@/features/wholesale/tax-condition";
import { ARGENTINA_PROVINCES } from "@/lib/constants/provinces";
import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";
import { formatCuit, isValidCuit, normalizeCuit } from "@/lib/utils/cuit";
import { TAX_CONDITIONS } from "@/lib/validations/wholesale-customer";

type CheckoutProduct = {
  id: string;
  name: string;
  imageUrl: string;
  imageAlt: string;
  priceArs: number;
  unitsPerDisplay: number;
  soldOut: boolean;
};

type CheckoutSettings = {
  minDisplays: number;
  enableMercadoPago: boolean;
  enableBankTransfer: boolean;
  enableEcheq: boolean;
  echeqInstructions: string | null;
  enableBankTransferDiscount: boolean;
  bankTransferDiscountPercentage: number;
  freeShippingThresholdArs: number | null;
};

type WholesaleCheckoutProps = {
  products: CheckoutProduct[];
  settings: CheckoutSettings;
  shippingRule: WholesaleShippingRule;
  businessTypes: string[];
  trustedCustomers: WholesaleCustomerProfile[];
};

type TaxCondition = (typeof TAX_CONDITIONS)[number];

// Mercado Pago usa su logo, igual que en la tienda; el resto, un icono.
const PAYMENT_ICONS: Partial<Record<WholesalePaymentMethod, LucideIcon>> = {
  BANK_TRANSFER: Landmark,
  ECHEQ: FileCheck2,
  DEFERRED: CalendarClock,
};

// "email": todavía no sabemos quién es. "cuit": el email existe pero este navegador no está recordado.
type Identity =
  | { stage: "email" }
  | { stage: "cuit" }
  | { stage: "new" }
  | { stage: "recognized"; customers: WholesaleCustomerProfile[]; customerId: string };

type Delivery = {
  contactName: string;
  phone: string;
  street: string;
  number: string;
  withoutNumber: boolean;
  floor: string;
  city: string;
  province: string;
  postalCode: string;
  reference: string;
};

const EMPTY_DELIVERY: Delivery = { contactName: "", phone: "", street: "", number: "", withoutNumber: false, floor: "", city: "", province: "", postalCode: "", reference: "" };

function deliveryFrom(customer: WholesaleCustomerProfile): Delivery {
  return {
    contactName: customer.contactName,
    phone: customer.phone,
    ...splitStreet(customer.street),
    floor: customer.floor ?? "",
    city: customer.city,
    province: customer.province,
    postalCode: customer.postalCode,
    reference: customer.reference ?? "",
  };
}

function customerLabel(customer: WholesaleCustomerProfile) {
  return `${customer.businessName || customer.legalName || customer.contactName} · CUIT ${formatCuit(customer.cuit)}`;
}

function Step({ number, title, children, aside }: { number: number; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-[2rem] bg-white p-5 shadow-card sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-display text-2xl leading-none text-brand-ink">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-pink font-body text-sm font-extrabold text-white">{number}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs font-bold text-brand-ink/70">
        {label}
      </label>
      {children}
    </div>
  );
}

const primaryButton =
  "inline-flex h-12 items-center justify-center rounded-full bg-brand-pink px-6 text-sm font-extrabold text-white shadow-soft transition hover:bg-[#ea737d] disabled:cursor-not-allowed disabled:bg-brand-ink/10 disabled:text-brand-ink/40 disabled:shadow-none";
const linkButton = "text-xs font-bold text-brand-pink hover:underline";
const stepButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-ink/15 text-base text-brand-ink transition hover:border-brand-pink hover:text-brand-pink";

async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, error: result?.error ?? "Algo salió mal. Probá de nuevo." };
    }
    return { ok: true, data: result.data as T };
  } catch {
    return { ok: false, error: "No pudimos conectarnos. Revisá tu conexión y probá de nuevo." };
  }
}

export function WholesaleCheckout({ products, settings, shippingRule, businessTypes, trustedCustomers }: WholesaleCheckoutProps) {
  const router = useRouter();
  const { items, hydrated } = useHydratedWholesaleCart();
  const setQuantity = useWholesaleCartStore((state) => state.setQuantity);
  const clearCart = useWholesaleCartStore((state) => state.clear);

  const [identity, setIdentity] = useState<Identity>(() =>
    trustedCustomers.length > 0 ? { stage: "recognized", customers: trustedCustomers, customerId: trustedCustomers[0]!.id } : { stage: "email" },
  );
  const [email, setEmail] = useState(trustedCustomers[0]?.email ?? "");
  const [cuit, setCuit] = useState("");
  const [legalName, setLegalName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [taxCondition, setTaxCondition] = useState<TaxCondition | "">(trustedCustomers[0]?.taxCondition ?? "");
  const [delivery, setDelivery] = useState<Delivery>(() => (trustedCustomers[0] ? deliveryFrom(trustedCustomers[0]) : EMPTY_DELIVERY));
  const [selectedPaymentMethod, setPaymentMethod] = useState<WholesalePaymentMethod | null>(null);
  const [notes, setNotes] = useState("");
  const [identifying, setIdentifying] = useState(false);
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Una clave por intento de compra: si el pedido ya se creó y se reintenta, el servidor devuelve el mismo.
  const [checkoutRequestKey] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`));

  const customer = identity.stage === "recognized" ? identity.customers.find((item) => item.id === identity.customerId) ?? null : null;

  const lines = useMemo(
    () =>
      items
        .map((item) => ({ product: products.find((product) => product.id === item.productId), quantity: item.quantity }))
        .filter((line): line is { product: CheckoutProduct; quantity: number } => Boolean(line.product)),
    [items, products],
  );
  const availableLines = lines.filter((line) => !line.product.soldOut);
  const suggestedProducts = products.filter((product) => !product.soldOut && !items.some((item) => item.productId === product.id));
  const displays = availableLines.reduce((sum, line) => sum + line.quantity, 0);
  const missing = Math.max(0, settings.minDisplays - displays);
  const subtotalArs = availableLines.reduce((sum, line) => sum + line.product.priceArs * line.quantity, 0);

  const fullStreet = joinStreet(delivery);
  const addressChanged = customer ? !isSameDeliveryAddress(customer, { ...delivery, street: fullStreet, floor: delivery.floor || null }) : false;
  const streetMayContainHeight = !delivery.withoutNumber && !delivery.number.trim() && /(?:^|\s)\d{3,8}\s*(?:bis|[a-z])?\s*$/i.test(delivery.street.trim());
  const addressPreview = useMemo(
    () =>
      buildAddressPreview({
        street: delivery.street,
        number: delivery.number,
        withoutNumber: delivery.withoutNumber,
        extra: delivery.floor,
        locality: delivery.city,
        province: delivery.province,
        postalCode: delivery.postalCode,
      }),
    [delivery.street, delivery.number, delivery.withoutNumber, delivery.floor, delivery.city, delivery.province, delivery.postalCode],
  );
  const deferredAvailable = Boolean(customer?.allowDeferredPayment) && !addressChanged;

  const paymentOptions = (
    [
      settings.enableMercadoPago ? "MERCADO_PAGO" : null,
      settings.enableBankTransfer ? "BANK_TRANSFER" : null,
      settings.enableEcheq ? "ECHEQ" : null,
      deferredAvailable ? "DEFERRED" : null,
    ] as (WholesalePaymentMethod | null)[]
  ).filter((method): method is WholesalePaymentMethod => method !== null);

  // Si el medio elegido deja de estar disponible (por ejemplo, cambió la dirección), hay que volver a elegir.
  const paymentMethod = selectedPaymentMethod && paymentOptions.includes(selectedPaymentMethod) ? selectedPaymentMethod : null;

  const shippingQuote = delivery.province
    ? calculateShippingQuote(subtotalArs, delivery.province, buildWholesaleShippingSettings(shippingRule, settings.freeShippingThresholdArs))
    : null;
  const pricing = calculateWholesalePricing({
    lines: availableLines.map((line) => ({ priceArs: line.product.priceArs, quantity: line.quantity })),
    extraDiscountPercentage: customer?.extraDiscountPercentage ?? 0,
    paymentMethod,
    enableBankTransferDiscount: settings.enableBankTransferDiscount,
    bankTransferDiscountPercentage: settings.bankTransferDiscountPercentage,
    shippingArs: shippingQuote?.shippingArs ?? 0,
  });

  const selectCustomer = (next: WholesaleCustomerProfile) => {
    setTaxCondition(next.taxCondition ?? "");
    setDelivery(deliveryFrom(next));
  };

  const resetIdentity = () => {
    setIdentity({ stage: "email" });
    setCuit("");
    setIdentifyError(null);
    setTaxCondition("");
    setDelivery(EMPTY_DELIVERY);
  };

  const identify = async () => {
    if (identity.stage === "cuit" && !isValidCuit(normalizeCuit(cuit))) {
      setIdentifyError("El CUIT no es válido: revisá los 11 números.");
      return;
    }

    setIdentifying(true);
    setIdentifyError(null);
    const result = await postJson<{ status: "new" } | { status: "needs_cuit" } | { status: "recognized"; customers: WholesaleCustomerProfile[] }>(
      "/api/mayoristas/identificar",
      { email, cuit: identity.stage === "cuit" ? cuit : undefined },
    );
    setIdentifying(false);

    if (!result.ok) {
      setIdentifyError(result.error);
      return;
    }

    if (result.data.status === "new") {
      setIdentity({ stage: "new" });
    } else if (result.data.status === "needs_cuit") {
      setIdentity({ stage: "cuit" });
    } else {
      // Si validó un CUIT, ese es el cliente del pedido; si no, el primero recordado.
      const normalized = normalizeCuit(cuit);
      const selected = result.data.customers.find((item) => item.cuit === normalized) ?? result.data.customers[0]!;
      setIdentity({ stage: "recognized", customers: result.data.customers, customerId: selected.id });
      selectCustomer(selected);
    }
  };

  const updateDelivery = (key: Exclude<keyof Delivery, "withoutNumber">, value: string) => setDelivery((current) => ({ ...current, [key]: value }));

  const canSubmit =
    hydrated && displays > 0 && missing === 0 && (identity.stage === "recognized" || identity.stage === "new") && paymentMethod !== null && !submitting;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !paymentMethod || !taxCondition) {
      return;
    }
    if (identity.stage === "new" && !isValidCuit(normalizeCuit(cuit))) {
      setSubmitError("El CUIT no es válido: revisá los 11 números.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    const result = await postJson<{ orderNumber: string; paymentMethod: WholesalePaymentMethod }>("/api/mayoristas/pedidos", {
      checkoutRequestKey,
      items: availableLines.map((line) => ({ wholesaleProductId: line.product.id, quantity: line.quantity })),
      customer:
        identity.stage === "recognized"
          ? { mode: "existing", customerId: identity.customerId }
          : { mode: "new", email, cuit, legalName, businessName, businessType },
      taxCondition,
      delivery: {
        contactName: delivery.contactName,
        phone: delivery.phone,
        street: fullStreet,
        floor: delivery.floor,
        city: delivery.city,
        province: delivery.province,
        postalCode: delivery.postalCode,
        reference: delivery.reference,
      },
      paymentMethod,
      notes,
    });

    if (!result.ok) {
      setSubmitting(false);
      setSubmitError(result.error);
      return;
    }

    clearCart();
    router.push(
      result.data.paymentMethod === "MERCADO_PAGO" ? `/checkout/mercado-pago/${result.data.orderNumber}` : `/mayoristas/pedido/${result.data.orderNumber}`,
    );
  };

  if (!hydrated) {
    return <div className="min-h-[60vh] bg-[#fff6f7]" aria-busy="true" />;
  }

  if (lines.length === 0) {
    return (
      <div className="bg-[#fff6f7] px-4 py-20 text-center">
        <h1 className="font-display text-4xl leading-none text-brand-ink">Tu pedido está vacío</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-brand-ink/65">
          Elegí los displays en la página mayorista. El mínimo es de {settings.minDisplays} displays en total y podés combinar sabores.
        </p>
        <Link href="/mayoristas#productos" className={cn(primaryButton, "mt-6")}>
          Ver productos y precios
        </Link>
      </div>
    );
  }

  const invoiceType = taxCondition ? getInvoiceType(taxCondition) : null;

  return (
    <div className="bg-[#fff6f7] px-4 py-10 md:px-6 md:py-14">
      <form onSubmit={submit} className="mx-auto grid max-w-[1080px] gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-brand-pink">iQ Kids Mayoristas</p>
            <h1 className="mt-2 font-display text-4xl leading-none text-brand-ink md:text-5xl">Tu pedido</h1>
          </div>

          <Step number={1} title="Productos" aside={<Link href="/mayoristas#productos" className={linkButton}>Agregar más</Link>}>
            <ul className="divide-y divide-brand-ink/10">
              {lines.map(({ product, quantity }) => (
                <li key={product.id} className="flex items-center gap-3 py-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#fff6f7]">
                    {product.imageUrl ? <Image src={product.imageUrl} alt={product.imageAlt || product.name} fill sizes="56px" className="object-contain" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-brand-ink">{product.name}</p>
                    <p className="text-xs tabular-nums text-brand-ink/55">
                      {product.soldOut ? "Sin stock: no se incluye en el pedido" : `${formatArs(product.priceArs)} / display · ${product.unitsPerDisplay} barritas`}
                    </p>
                  </div>
                  {product.soldOut ? null : (
                    <div className="flex items-center gap-1.5">
                      <button type="button" aria-label={`Quitar un display de ${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)} className={stepButton}>
                        −
                      </button>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        aria-label={`Displays de ${product.name}`}
                        value={quantity}
                        onChange={(event) => setQuantity(product.id, Number.parseInt(event.target.value, 10) || 0)}
                        className="h-8 w-14 rounded-xl border border-brand-ink/15 text-center text-base tabular-nums text-brand-ink outline-none focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20 md:text-sm"
                      />
                      <button type="button" aria-label={`Sumar un display de ${product.name}`} onClick={() => setQuantity(product.id, quantity + 1)} className={stepButton}>
                        +
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label={`Sacar ${product.name} del pedido`}
                    onClick={() => setQuantity(product.id, 0)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brand-ink/40 transition hover:text-brand-pink"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <p role="status" aria-live="polite" className={cn("mt-3 text-sm", missing > 0 ? "font-bold text-brand-pink" : "text-brand-ink/60")}>
              {displays} display{displays === 1 ? "" : "s"} ·{" "}
              {missing > 0
                ? `El mínimo es de ${settings.minDisplays}: ${missing === 1 ? "te falta 1 display" : `te faltan ${missing} displays`}.`
                : "Llegaste al pedido mínimo."}
            </p>

            {suggestedProducts.length > 0 ? (
              <div className="mt-5 rounded-[1.65rem] border border-brand-ink/8 bg-white p-4 shadow-[0_10px_26px_rgba(44,34,65,0.04)]">
                <p className="mb-3 text-sm font-extrabold leading-5 text-brand-ink">Sumar otro sabor</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {suggestedProducts.map((product) => (
                    <div
                      key={product.id}
                      className="grid grid-cols-[58px_minmax(0,1fr)_92px] items-center gap-3 rounded-[1.25rem] border border-brand-ink/8 bg-brand-cream/35 p-3 transition hover:border-brand-pink/30 hover:bg-white hover:shadow-[0_12px_30px_rgba(44,34,65,0.06)]"
                    >
                      <div className="relative h-14 w-14 overflow-hidden rounded-[1rem] bg-white shadow-[0_8px_18px_rgba(44,34,65,0.06)]">
                        {product.imageUrl ? (
                          <Image src={product.imageUrl} alt={product.imageAlt || product.name} fill sizes="56px" className="object-contain p-1.5" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[0.92rem] font-extrabold leading-5 text-brand-ink">{product.name}</p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-brand-ink/55">{formatArs(product.priceArs)}</p>
                      </div>
                      <div className="inline-flex items-center justify-self-end rounded-full border border-brand-ink/12 bg-white shadow-[0_8px_18px_rgba(44,34,65,0.05)]">
                        <button
                          type="button"
                          className="flex h-9 w-8 cursor-not-allowed items-center justify-center text-lg font-light text-brand-ink/25"
                          disabled
                          aria-label={`${product.name} todavía no está en el pedido`}
                        >
                          -
                        </button>
                        <span className="flex h-9 min-w-7 items-center justify-center text-sm font-extrabold text-brand-ink/55">0</span>
                        <button
                          type="button"
                          className="flex h-9 w-8 items-center justify-center text-lg font-light text-brand-pink transition hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/30"
                          aria-label={`Agregar ${product.name} al pedido`}
                          onClick={() => setQuantity(product.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Step>

          <Step
            number={2}
            title="Tus datos"
            aside={identity.stage !== "email" ? <button type="button" onClick={resetIdentity} className={linkButton}>Usar otro email</button> : null}
          >
            {identity.stage === "email" || identity.stage === "cuit" ? (
              <IdentifyFields
                stage={identity.stage}
                email={email}
                cuit={cuit}
                onEmail={setEmail}
                onCuit={setCuit}
                busy={identifying}
                error={identifyError}
                onSubmit={identify}
              />
            ) : identity.stage === "recognized" && customer ? (
              <div className="space-y-4">
                <p className="text-sm text-brand-ink/70">
                  ¡Hola de nuevo! Pedido a nombre de <strong className="text-brand-ink">{customer.email}</strong>.
                </p>
                {identity.customers.length > 1 ? (
                  <Field label="¿Para qué CUIT es el pedido?" htmlFor="w-customer">
                    <Select
                      id="w-customer"
                      value={identity.customerId}
                      onChange={(event) => {
                        const next = identity.customers.find((item) => item.id === event.target.value);
                        if (!next) return;
                        setIdentity({ ...identity, customerId: next.id });
                        selectCustomer(next);
                      }}
                    >
                      {identity.customers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {customerLabel(item)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <p className="rounded-2xl bg-[#fff6f7] px-4 py-3 text-sm font-bold text-brand-ink">{customerLabel(customer)}</p>
                )}
                {customer.extraDiscountPercentage > 0 ? (
                  <p className="text-sm font-bold text-brand-ink">Tenés un descuento especial del {customer.extraDiscountPercentage}% en este pedido.</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-brand-ink/70">
                  Es tu primer pedido con <strong className="text-brand-ink">{email}</strong>. Completá los datos del negocio para la factura.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="CUIT *" htmlFor="w-cuit">
                    <Input
                      id="w-cuit"
                      inputMode="numeric"
                      placeholder="11 números"
                      value={cuit}
                      onChange={(event) => setCuit(event.target.value.replace(/[^0-9-]/g, "").slice(0, 13))}
                      required
                    />
                  </Field>
                  <Field label="Razón social" htmlFor="w-legal">
                    <Input id="w-legal" value={legalName} onChange={(event) => setLegalName(event.target.value)} placeholder="Como figura en AFIP" />
                  </Field>
                  <Field label="Nombre del negocio" htmlFor="w-business">
                    <Input id="w-business" value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
                  </Field>
                  <Field label="Tipo de negocio" htmlFor="w-type">
                    <Select id="w-type" value={businessType} onChange={(event) => setBusinessType(event.target.value)}>
                      <option value="">Elegí una opción</option>
                      {businessTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>
            )}

            {identity.stage === "recognized" || identity.stage === "new" ? (
              <div className="mt-4">
                <Field label="Condición frente al IVA *" htmlFor="w-tax">
                  <Select id="w-tax" value={taxCondition} onChange={(event) => setTaxCondition(event.target.value as TaxCondition | "")} required>
                    <option value="">Elegí una opción</option>
                    {TAX_CONDITIONS.map((condition) => (
                      <option key={condition} value={condition}>
                        {TAX_CONDITION_LABELS[condition]}
                      </option>
                    ))}
                  </Select>
                </Field>
                {invoiceType ? <p className="mt-1.5 text-xs text-brand-ink/55">Te facturamos con factura {invoiceType}.</p> : null}
              </div>
            ) : null}
          </Step>

          {identity.stage === "recognized" || identity.stage === "new" ? (
            <>
              <Step number={3} title="Entrega">
                <p className="-mt-3 mb-4 text-sm text-brand-ink/60">Completalos tal como deben figurar en el envío.</p>
                <div className="grid gap-x-4 gap-y-3 md:grid-cols-3">
                  <FieldShell label="Quién recibe" className="md:col-span-2">
                    <Input autoComplete="name" placeholder="Nombre y apellido" value={delivery.contactName} onChange={(event) => updateDelivery("contactName", event.target.value)} required />
                  </FieldShell>
                  <FieldShell label="Teléfono / WhatsApp">
                    <Input type="tel" autoComplete="tel" placeholder="Ej: 11 2345 6789" value={delivery.phone} onChange={(event) => updateDelivery("phone", event.target.value)} required />
                  </FieldShell>
                  <FieldShell label="Provincia">
                    <Select autoComplete="address-level1" value={delivery.province} onChange={(event) => updateDelivery("province", event.target.value)} required>
                      <option value="">Elegí una provincia</option>
                      {ARGENTINA_PROVINCES.map((province) => (
                        <option key={province.code} value={province.name}>
                          {province.name}
                        </option>
                      ))}
                      {delivery.province && !ARGENTINA_PROVINCES.some((province) => province.name === delivery.province) ? (
                        <option value={delivery.province}>{delivery.province}</option>
                      ) : null}
                    </Select>
                  </FieldShell>
                  <FieldShell label="Localidad">
                    <Input placeholder="Ej: Vicente López" autoComplete="address-level2" value={delivery.city} onChange={(event) => updateDelivery("city", event.target.value)} required />
                  </FieldShell>
                  <FieldShell label="Código postal">
                    <Input placeholder="Ej: 1425" autoComplete="postal-code" inputMode="numeric" value={delivery.postalCode} onChange={(event) => updateDelivery("postalCode", event.target.value)} required />
                  </FieldShell>
                  <FieldShell label="Calle" className={delivery.withoutNumber ? "md:col-span-3" : "md:col-span-2"}>
                    <Input placeholder="Ej: Calle 11 o Amenábar" autoComplete="address-line1" value={delivery.street} onChange={(event) => updateDelivery("street", event.target.value)} required />
                    {streetMayContainHeight ? (
                      <p className="mt-1.5 text-xs font-medium leading-5 text-brand-ink/55">
                        Si ese número es la altura, cargalo en el campo de al lado. Las calles como &quot;Calle 11&quot; están permitidas.
                      </p>
                    ) : null}
                  </FieldShell>
                  {!delivery.withoutNumber ? (
                    <FieldShell label="Altura">
                      <Input placeholder="Ej: 2451" autoComplete="off" inputMode="numeric" value={delivery.number} onChange={(event) => updateDelivery("number", event.target.value)} required />
                    </FieldShell>
                  ) : null}
                  <label className="group -mt-1 inline-flex w-fit cursor-pointer items-center gap-2 text-left focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-pink focus-within:ring-offset-2 md:col-span-3">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={delivery.withoutNumber}
                      onChange={(event) => setDelivery((current) => ({ ...current, withoutNumber: event.target.checked, number: event.target.checked ? "" : current.number }))}
                    />
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-brand-ink/30 bg-white text-white transition-colors peer-checked:border-brand-pink peer-checked:bg-brand-pink">
                      <CheckCircle2 className={cn("h-3 w-3 transition-opacity", delivery.withoutNumber ? "opacity-100" : "opacity-0")} />
                    </span>
                    <span className="text-sm font-semibold text-brand-ink/70">La calle no tiene altura</span>
                  </label>
                  <FieldShell label="Piso / Depto" className="md:col-span-3">
                    <Input placeholder="Ej: Piso 4 Depto B" autoComplete="address-line2" value={delivery.floor} onChange={(event) => updateDelivery("floor", event.target.value)} />
                  </FieldShell>

                  {addressPreview ? (
                    <div className="md:col-span-3">
                      <AddressMapPreview preview={addressPreview} />
                    </div>
                  ) : null}

                  <div className="md:col-span-3">
                    <FieldShell label="Observaciones">
                      <Textarea
                        placeholder="Ej: Timbre roto. Tocar portería. Recibe Lucía por la tarde."
                        maxLength={200}
                        value={delivery.reference}
                        onChange={(event) => updateDelivery("reference", event.target.value)}
                      />
                    </FieldShell>
                  </div>
                </div>
                {customer && addressChanged ? (
                  <p className="mt-4 rounded-2xl bg-brand-yellow/40 px-4 py-3 text-sm text-brand-ink">
                    Es una dirección distinta a la que tenemos cargada. Le avisamos al equipo con el pedido
                    {customer.allowDeferredPayment ? " y, para esta entrega, el pago tiene que ser anticipado" : ""}.
                    {" "}
                    <button type="button" onClick={() => selectCustomer(customer)} className={linkButton}>
                      Volver a la dirección cargada
                    </button>
                  </p>
                ) : null}
              </Step>

              <Step number={4} title="Pago">
                <div className="grid gap-3" role="radiogroup" aria-label="Medio de pago">
                  {paymentOptions.map((method) => (
                    <PaymentOptionCard
                      key={method}
                      asRadio
                      title={WHOLESALE_PAYMENT_METHOD_LABELS[method]}
                      description={
                        method === "MERCADO_PAGO"
                          ? "Tarjeta, dinero en cuenta o lo que tengas en Mercado Pago."
                          : method === "BANK_TRANSFER"
                            ? "Te mostramos los datos al confirmar. Despachamos cuando se acredita."
                            : method === "ECHEQ"
                              ? settings.echeqInstructions || "Emitís el eCheq y subís el comprobante. Despachamos cuando lo recibimos."
                              : "Según las condiciones acordadas con tu cuenta. Pagás después de recibir el pedido."
                      }
                      note={
                        method === "BANK_TRANSFER" && settings.enableBankTransferDiscount && settings.bankTransferDiscountPercentage > 0
                          ? `${settings.bankTransferDiscountPercentage}% de descuento pagando por transferencia`
                          : null
                      }
                      selected={paymentMethod === method}
                      onSelect={() => setPaymentMethod(method)}
                      icon={PAYMENT_ICONS[method]}
                      logo={method === "MERCADO_PAGO" ? { src: "/brand/mercado-pago-logo.png", alt: "Mercado Pago" } : undefined}
                    />
                  ))}
                </div>
                <div className="mt-4">
                  <Field label="Comentarios" htmlFor="w-notes">
                    <Textarea id="w-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Algo que tengamos que saber del pedido" />
                  </Field>
                </div>
              </Step>
            </>
          ) : null}
        </div>

        <aside className="rounded-[2rem] bg-white p-5 shadow-card sm:p-7 lg:sticky lg:top-24">
          <h2 className="font-display text-2xl leading-none text-brand-ink">Resumen</h2>
          <dl className="mt-5 space-y-2.5 text-sm tabular-nums">
            <div className="flex justify-between gap-3">
              <dt className="text-brand-ink/65">
                Subtotal ({displays} display{displays === 1 ? "" : "s"})
              </dt>
              <dd className="font-bold text-brand-ink">{formatArs(pricing.subtotalArs)}</dd>
            </div>
            {pricing.extraDiscountArs > 0 ? (
              <div className="flex justify-between gap-3">
                <dt className="text-brand-ink/65">Descuento especial ({pricing.extraDiscountPercentage}%)</dt>
                <dd className="font-bold text-brand-ink">−{formatArs(pricing.extraDiscountArs)}</dd>
              </div>
            ) : null}
            {pricing.transferDiscountArs > 0 ? (
              <div className="flex justify-between gap-3">
                <dt className="text-brand-ink/65">Descuento por transferencia ({pricing.transferDiscountPercentage}%)</dt>
                <dd className="font-bold text-brand-ink">−{formatArs(pricing.transferDiscountArs)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="text-brand-ink/65">Envío</dt>
              <dd className="font-bold text-brand-ink">
                {shippingQuote ? (shippingQuote.shippingArs > 0 ? formatArs(shippingQuote.shippingArs) : "Sin cargo") : "Elegí la provincia"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t-2 border-brand-ink/10 pt-3">
              <dt className="font-extrabold text-brand-ink">Total</dt>
              <dd className="font-display text-3xl text-brand-ink">{formatArs(pricing.totalArs)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-brand-ink/50">Precios con IVA incluido.</p>

          <button type="submit" className={cn(primaryButton, "mt-5 w-full")} disabled={!canSubmit}>
            {submitting ? "Confirmando…" : paymentMethod === "MERCADO_PAGO" ? "Confirmar y pagar" : "Confirmar pedido"}
          </button>
          {submitError ? (
            <p role="alert" className="mt-3 text-center text-sm font-bold text-red-600">
              {submitError}
            </p>
          ) : !canSubmit && !submitting ? (
            <p className="mt-3 text-center text-xs text-brand-ink/50">
              {missing > 0
                ? `Sumá ${missing === 1 ? "1 display" : `${missing} displays`} para llegar al mínimo.`
                : identity.stage === "email" || identity.stage === "cuit"
                  ? "Ingresá tu email para seguir."
                  : "Elegí cómo vas a pagar."}
            </p>
          ) : null}
        </aside>
      </form>
    </div>
  );
}

function IdentifyFields({
  stage,
  email,
  cuit,
  onEmail,
  onCuit,
  busy,
  error,
  onSubmit,
}: {
  stage: "email" | "cuit";
  email: string;
  cuit: string;
  onEmail: (value: string) => void;
  onCuit: (value: string) => void;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  // Va dentro del formulario del pedido: botones type="button" y Enter manejado a mano para no mandar el pedido.
  const send = onSubmit;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Email *" htmlFor="w-email">
          <Input
            id="w-email"
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            value={email}
            readOnly={stage === "cuit"}
            onChange={(event) => onEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && stage === "email") {
                event.preventDefault();
                send();
              }
            }}
          />
        </Field>
        {stage === "email" ? (
          <button type="button" className={primaryButton} disabled={busy || !email.includes("@")} onClick={send}>
            {busy ? "Buscando…" : "Continuar"}
          </button>
        ) : null}
      </div>
      {stage === "email" ? <p className="text-xs text-brand-ink/55">Si ya nos compraste, precargamos tus datos.</p> : null}

      {stage === "cuit" ? (
        <>
          <p className="text-sm text-brand-ink/70">Ya tenemos una cuenta con ese email. Para ver tus datos en este dispositivo, confirmá el CUIT del negocio.</p>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="CUIT *" htmlFor="w-verify-cuit">
              <Input
                id="w-verify-cuit"
                inputMode="numeric"
                placeholder="11 números"
                value={cuit}
                onChange={(event) => onCuit(event.target.value.replace(/[^0-9-]/g, "").slice(0, 13))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    send();
                  }
                }}
              />
            </Field>
            <button type="button" className={primaryButton} disabled={busy || normalizeCuit(cuit).length !== 11} onClick={send}>
              {busy ? "Verificando…" : "Confirmar"}
            </button>
          </div>
          <p className="text-xs text-brand-ink/55">Lo pedimos una sola vez: este navegador queda recordado por 90 días.</p>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-bold text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
