"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, CalendarClock, CheckCircle2, FileCheck2, Landmark, Trash2, type LucideIcon } from "lucide-react";

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
import { trackWholesaleAddToCart } from "@/lib/integrations/wholesale-commerce-tracking";
import { customEvent } from "@/lib/pixel";
import { WHOLESALE_META_CHANNEL, WHOLESALE_META_EVENTS } from "@/lib/wholesale-meta-events";

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

function Field({ label, htmlFor, children, className, error }: { label: string; htmlFor: string; children: ReactNode; className?: string; error?: string }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5",
        error && "[&_input]:border-red-400 [&_input]:bg-red-50/30 [&_select]:border-red-400 [&_select]:bg-red-50/30",
        className,
      )}
    >
      <label htmlFor={htmlFor} className={cn("text-xs font-bold", error ? "text-red-600" : "text-brand-ink/70")}>
        {label}
      </label>
      {children}
      {error ? <p className="text-[11px] font-semibold leading-4 text-red-600">{error}</p> : null}
    </div>
  );
}

// Lo que falta para confirmar, en el orden en que aparece en la página (así se baja al primero).
type CheckoutErrorKey =
  | "products"
  | "email"
  | "cuit"
  | "taxCondition"
  | "contactName"
  | "phone"
  | "province"
  | "city"
  | "postalCode"
  | "street"
  | "number"
  | "payment";
type CheckoutErrors = Partial<Record<CheckoutErrorKey, string>>;

const ERROR_TARGETS: Record<CheckoutErrorKey, string> = {
  products: "w-products",
  email: "w-email",
  cuit: "w-cuit",
  taxCondition: "w-tax",
  contactName: "w-contact",
  phone: "w-phone",
  province: "w-province",
  city: "w-city",
  postalCode: "w-postal",
  street: "w-street",
  number: "w-number",
  payment: "w-payment",
};

function ErrorSummary({ show, className }: { show: boolean; className?: string }) {
  if (!show) return null;

  return (
    <div role="alert" className={cn("flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700", className)}>
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <p>Revisá los campos marcados en rojo.</p>
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
  const [remember, setRemember] = useState(false);
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
  // Se prende al tocar "Confirmar" con datos faltantes: desde ahí se marcan en rojo.
  const [attempted, setAttempted] = useState(false);
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

  // Mismo aviso verde que el checkout de la tienda: cuánto falta para el descuento o el envío gratis.
  const freeShippingThreshold = settings.freeShippingThresholdArs;
  const amountToFreeShipping = freeShippingThreshold ? Math.max(0, freeShippingThreshold - subtotalArs) : 0;
  const amountToShippingDiscount = shippingRule.discountThresholdArs ? Math.max(0, shippingRule.discountThresholdArs - subtotalArs) : 0;
  const shippingDiscountPercentage = shippingRule.discountPercentage ?? 0;
  const shippingNudge = !shippingQuote
    ? shippingDiscountPercentage > 0 && amountToShippingDiscount === 0 && shippingRule.discountThresholdArs
      ? `Tu pedido tiene ${shippingDiscountPercentage}% off en el envío. Elegí la provincia para verlo.`
      : null
    : shippingQuote.freeShippingReached
      ? "Ya tenés envío gratis."
      : shippingQuote.shippingDiscountReached
        ? `Tenés ${shippingQuote.shippingDiscountPercentage}% off en el envío.${
            freeShippingThreshold && amountToFreeShipping > 0 ? ` Si llegás a ${formatArs(freeShippingThreshold)}, el envío es gratis.` : ""
          }`
        : shippingQuote.shippingArs > 0 && amountToShippingDiscount > 0 && shippingDiscountPercentage > 0
          ? `Sumá ${formatArs(amountToShippingDiscount)} más y activá ${shippingDiscountPercentage}% off en el envío.`
          : shippingQuote.shippingArs > 0 && freeShippingThreshold && amountToFreeShipping > 0
            ? `Te faltan ${formatArs(amountToFreeShipping)} para el envío gratis.`
            : null;

  // Una vez por intento de compra, como InitiateCheckout en la tienda.
  const trackedCheckoutRef = useRef(false);
  useEffect(() => {
    if (!hydrated || trackedCheckoutRef.current || displays === 0) return;
    trackedCheckoutRef.current = true;
    const storageKey = `meta:initiate_checkout_mayorista:${checkoutRequestKey}`;
    if (window.sessionStorage.getItem(storageKey)) return;
    window.sessionStorage.setItem(storageKey, "1");
    customEvent(WHOLESALE_META_EVENTS.initiateCheckout, {
      value: pricing.totalArs,
      currency: "ARS",
      num_items: displays,
      channel: WHOLESALE_META_CHANNEL,
    });
  }, [hydrated, displays, checkoutRequestKey, pricing.totalArs]);

  const addDisplay = (product: CheckoutProduct, nextQuantity: number) => {
    setQuantity(product.id, nextQuantity);
    trackWholesaleAddToCart({ productId: product.id, productName: product.name, priceArs: product.priceArs, quantity: 1 });
  };

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
      { email, cuit: identity.stage === "cuit" ? cuit : undefined, remember },
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

  // Igual que en la tienda: el botón siempre se puede tocar y, si falta algo, se marca en rojo.
  const checkoutErrors: CheckoutErrors = {};
  if (displays === 0) {
    checkoutErrors.products = "Sumá al menos un display al pedido.";
  } else if (missing > 0) {
    checkoutErrors.products = `El mínimo es de ${settings.minDisplays} displays: ${missing === 1 ? "te falta 1" : `te faltan ${missing}`}.`;
  }
  if (identity.stage === "email") {
    checkoutErrors.email = email.includes("@") ? "Tocá “Continuar” para validar tu email." : "Ingresá tu email.";
  } else if (identity.stage === "cuit") {
    checkoutErrors.cuit = "Confirmá el CUIT del negocio para seguir.";
  } else {
    if (identity.stage === "new") {
      if (!cuit.trim()) checkoutErrors.cuit = "Completá el CUIT.";
      else if (!isValidCuit(normalizeCuit(cuit))) checkoutErrors.cuit = "El CUIT no es válido: revisá los 11 números.";
    }
    if (!taxCondition) checkoutErrors.taxCondition = "Elegí tu condición frente al IVA.";
    if (!delivery.contactName.trim()) checkoutErrors.contactName = "Completá quién recibe.";
    if (!delivery.phone.trim()) checkoutErrors.phone = "Completá el teléfono.";
    else if (delivery.phone.replace(/\D/g, "").length < 8) checkoutErrors.phone = "Revisá el teléfono: tiene que tener al menos 8 números.";
    if (!delivery.province) checkoutErrors.province = "Elegí la provincia.";
    if (!delivery.city.trim()) checkoutErrors.city = "Completá la localidad.";
    if (!delivery.postalCode.trim()) checkoutErrors.postalCode = "Completá el código postal.";
    if (!delivery.street.trim()) checkoutErrors.street = "Completá la calle.";
    if (!delivery.withoutNumber && !delivery.number.trim()) checkoutErrors.number = "Completá la altura.";
    if (!paymentMethod) checkoutErrors.payment = "Elegí cómo vas a pagar.";
  }
  const errorKeys = Object.keys(checkoutErrors) as CheckoutErrorKey[];
  // Los errores se muestran recién después del primer intento, y se van limpiando a medida que se completa.
  const errors: CheckoutErrors = attempted ? checkoutErrors : {};
  const firstErrorMessage = attempted && errorKeys.length > 0 ? checkoutErrors[errorKeys[0]!] : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hydrated || submitting) {
      return;
    }
    if (errorKeys.length > 0 || !paymentMethod || !taxCondition) {
      setAttempted(true);
      const firstKey = errorKeys[0];
      const target = firstKey ? document.getElementById(firstKey === "cuit" && identity.stage === "cuit" ? "w-verify-cuit" : ERROR_TARGETS[firstKey]) : null;
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.focus({ preventScroll: true });
      }
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    const result = await postJson<{ orderNumber: string; paymentMethod: WholesalePaymentMethod }>("/api/mayoristas/pedidos", {
      checkoutRequestKey,
      remember,
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
      <form onSubmit={submit} noValidate className="mx-auto grid max-w-[1080px] gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
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
                      <button type="button" aria-label={`Sumar un display de ${product.name}`} onClick={() => addDisplay(product, quantity + 1)} className={stepButton}>
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
            <p
              id="w-products"
              tabIndex={-1}
              role="status"
              aria-live="polite"
              className={cn("mt-3 text-sm outline-none", errors.products ? "font-bold text-red-600" : missing > 0 ? "font-bold text-brand-pink" : "text-brand-ink/60")}
            >
              {displays} display{displays === 1 ? "" : "s"} ·{" "}
              {missing > 0
                ? `El mínimo es de ${settings.minDisplays}: ${missing === 1 ? "te falta 1 display" : `te faltan ${missing} displays`}.`
                : "Llegaste al pedido mínimo."}
            </p>

            {suggestedProducts.length > 0 ? (
              <div className="mt-5 rounded-[1.65rem] border border-brand-ink/8 bg-white p-4 shadow-[0_10px_26px_rgba(44,34,65,0.04)]">
                <p className="mb-3 text-sm font-extrabold leading-5 text-brand-ink">Sumar otro sabor</p>
                <div className="grid gap-3">
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
                          onClick={() => addDisplay(product, 1)}
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
                remember={remember}
                onEmail={setEmail}
                onCuit={setCuit}
                onRemember={setRemember}
                busy={identifying}
                error={identifyError}
                onSubmit={identify}
                emailError={errors.email}
                cuitError={errors.cuit}
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
                  <Field label="CUIT *" htmlFor="w-cuit" error={errors.cuit}>
                    <Input
                      id="w-cuit"
                      inputMode="numeric"
                      placeholder="11 números"
                      value={cuit}
                      onChange={(event) => setCuit(event.target.value.replace(/[^0-9-]/g, "").slice(0, 13))}
                      required
                      aria-invalid={errors.cuit ? "true" : "false"}
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
                <Field label="Condición frente al IVA *" htmlFor="w-tax" error={errors.taxCondition}>
                  <Select
                    id="w-tax"
                    value={taxCondition}
                    onChange={(event) => setTaxCondition(event.target.value as TaxCondition | "")}
                    required
                    aria-invalid={errors.taxCondition ? "true" : "false"}
                  >
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
                <ErrorSummary
                  className="mb-4"
                  show={Boolean(errors.contactName || errors.phone || errors.province || errors.city || errors.postalCode || errors.street || errors.number)}
                />
                <div className="grid gap-x-4 gap-y-3 md:grid-cols-3">
                  <FieldShell label="Quién recibe" className="md:col-span-2" error={errors.contactName}>
                    <Input id="w-contact" aria-invalid={errors.contactName ? "true" : "false"} autoComplete="name" placeholder="Nombre y apellido" value={delivery.contactName} onChange={(event) => updateDelivery("contactName", event.target.value)} required />
                  </FieldShell>
                  <FieldShell label="Teléfono / WhatsApp" error={errors.phone}>
                    <Input id="w-phone" aria-invalid={errors.phone ? "true" : "false"} type="tel" autoComplete="tel" placeholder="Ej: 11 2345 6789" value={delivery.phone} onChange={(event) => updateDelivery("phone", event.target.value)} required />
                  </FieldShell>
                  <FieldShell label="Provincia" error={errors.province}>
                    <Select id="w-province" aria-invalid={errors.province ? "true" : "false"} autoComplete="address-level1" value={delivery.province} onChange={(event) => updateDelivery("province", event.target.value)} required>
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
                  <FieldShell label="Localidad" error={errors.city}>
                    <Input id="w-city" aria-invalid={errors.city ? "true" : "false"} placeholder="Ej: Vicente López" autoComplete="address-level2" value={delivery.city} onChange={(event) => updateDelivery("city", event.target.value)} required />
                  </FieldShell>
                  <FieldShell label="Código postal" error={errors.postalCode}>
                    <Input id="w-postal" aria-invalid={errors.postalCode ? "true" : "false"} placeholder="Ej: 1425" autoComplete="postal-code" inputMode="numeric" value={delivery.postalCode} onChange={(event) => updateDelivery("postalCode", event.target.value)} required />
                  </FieldShell>
                  <FieldShell label="Calle" className={delivery.withoutNumber ? "md:col-span-3" : "md:col-span-2"} error={errors.street}>
                    <Input id="w-street" aria-invalid={errors.street ? "true" : "false"} placeholder="Ej: Calle 11 o Amenábar" autoComplete="address-line1" value={delivery.street} onChange={(event) => updateDelivery("street", event.target.value)} required />
                    {streetMayContainHeight ? (
                      <p className="mt-1.5 text-xs font-medium leading-5 text-brand-ink/55">
                        Si ese número es la altura, cargalo en el campo de al lado. Las calles como &quot;Calle 11&quot; están permitidas.
                      </p>
                    ) : null}
                  </FieldShell>
                  {!delivery.withoutNumber ? (
                    <FieldShell label="Altura" error={errors.number}>
                      <Input id="w-number" aria-invalid={errors.number ? "true" : "false"} placeholder="Ej: 2451" autoComplete="off" inputMode="numeric" value={delivery.number} onChange={(event) => updateDelivery("number", event.target.value)} required />
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
                <div
                  id="w-payment"
                  tabIndex={-1}
                  className={cn("grid gap-3 rounded-[1.6rem] outline-none", errors.payment && "ring-2 ring-red-400 ring-offset-4")}
                  role="radiogroup"
                  aria-label="Medio de pago"
                  aria-invalid={errors.payment ? "true" : undefined}
                >
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
                {errors.payment ? <p className="mt-3 text-sm font-bold text-red-600">{errors.payment}</p> : null}
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
                <dd className="font-bold text-green-700">- {formatArs(pricing.extraDiscountArs)}</dd>
              </div>
            ) : null}
            {pricing.transferDiscountArs > 0 ? (
              <div className="flex justify-between gap-3">
                <dt className="text-brand-ink/65">Descuento por transferencia ({pricing.transferDiscountPercentage}%)</dt>
                <dd className="font-bold text-green-700">- {formatArs(pricing.transferDiscountArs)}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-brand-ink/65">Envío</dt>
              <dd className="font-bold text-brand-ink">
                {!shippingQuote ? (
                  <span className="font-semibold text-brand-ink/50">Elegí la provincia</span>
                ) : shippingQuote.freeShippingReached || (shippingQuote.shippingArs === 0 && shippingQuote.baseShippingArs > 0) ? (
                  <span className="text-emerald-700">Gratis</span>
                ) : shippingQuote.shippingDiscountReached ? (
                  <span className="flex items-center gap-2">
                    <span className="text-brand-ink/35 line-through">{formatArs(shippingQuote.baseShippingArs)}</span>
                    <span className="text-emerald-700">{formatArs(shippingQuote.shippingArs)}</span>
                  </span>
                ) : shippingQuote.shippingArs > 0 ? (
                  formatArs(shippingQuote.shippingArs)
                ) : (
                  <span className="text-emerald-700">Sin cargo</span>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-brand-ink/10 pt-3">
              <dt className="font-extrabold text-brand-ink">Total</dt>
              <dd className="text-2xl font-extrabold text-brand-pink md:text-3xl">{formatArs(pricing.totalArs)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-brand-ink/50">Precios con IVA incluido.</p>
          {shippingNudge ? <p className="mt-3 text-sm font-bold leading-6 text-emerald-700">{shippingNudge}</p> : null}

          <button type="submit" className={cn(primaryButton, "mt-5 w-full")} disabled={submitting}>
            {submitting ? "Confirmando…" : paymentMethod === "MERCADO_PAGO" ? "Confirmar y pagar" : "Confirmar pedido"}
          </button>
          {submitError ? (
            <p role="alert" className="mt-3 text-center text-sm font-bold text-red-600">
              {submitError}
            </p>
          ) : firstErrorMessage ? (
            <p role="alert" className="mt-3 text-center text-sm font-bold text-red-600">
              {errorKeys.length > 1 ? `${firstErrorMessage} Revisá lo marcado en rojo.` : firstErrorMessage}
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
  remember,
  onEmail,
  onCuit,
  onRemember,
  busy,
  error,
  onSubmit,
  emailError,
  cuitError,
}: {
  stage: "email" | "cuit";
  email: string;
  cuit: string;
  remember: boolean;
  onEmail: (value: string) => void;
  onCuit: (value: string) => void;
  onRemember: (value: boolean) => void;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
  emailError?: string;
  cuitError?: string;
}) {
  // Va dentro del formulario del pedido: botones type="button" y Enter manejado a mano para no mandar el pedido.
  const send = onSubmit;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Email *" htmlFor="w-email" error={emailError}>
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

      <label className="group flex w-fit cursor-pointer items-start gap-2 text-left focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-pink focus-within:ring-offset-2">
        <input type="checkbox" className="peer sr-only" checked={remember} onChange={(event) => onRemember(event.target.checked)} />
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-brand-ink/30 bg-white text-white transition-colors peer-checked:border-brand-pink peer-checked:bg-brand-pink">
          <CheckCircle2 className={cn("h-3 w-3 transition-opacity", remember ? "opacity-100" : "opacity-0")} />
        </span>
        <span>
          <span className="block text-sm font-semibold text-brand-ink/70">Acepto que guarden mis datos para futuras compras</span>
          <span className="mt-0.5 block text-xs text-brand-ink/55">Recordamos tu empresa y dirección en este navegador, así no tenés que volver a validarte.</span>
        </span>
      </label>

      {stage === "cuit" ? (
        <>
          <p className="text-sm text-brand-ink/70">Ya tenemos una cuenta con ese email. Para ver tus datos en este dispositivo, confirmá el CUIT del negocio.</p>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="CUIT *" htmlFor="w-verify-cuit" error={cuitError}>
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
