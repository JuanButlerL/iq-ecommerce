"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Product, ProductImage, ShippingRule, ShippingRuleProvince, StoreSettings } from "@prisma/client";
import { AlertCircle, CheckCircle2, MapPinned, Plus, TicketPercent } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { TrackEventOnView } from "@/components/analytics/track-event-on-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore } from "@/features/cart/store";
import { announceCartItemAdded } from "@/features/cart/cart-feedback-event";
import { calculateCheckoutPricing } from "@/features/checkout/lib/pricing";
import { calculateShippingQuote } from "@/features/cart/lib/shipping";
import { PaymentMethodSelector } from "@/features/checkout/components/payment-method-selector";
import { getCouponDiscountLabel } from "@/features/coupons/lib/coupon-pricing";
import { productFallbackImageMap } from "@/features/catalog/product-theme";
import { trackAddToCart } from "@/lib/integrations/commerce-tracking";
import { trackEvent } from "@/lib/integrations/google-analytics/client";
import { ARGENTINA_PROVINCES } from "@/lib/constants/provinces";
import { event as trackMetaEvent } from "@/lib/pixel";
import { checkoutCustomerSchema, type CheckoutCustomerInput } from "@/lib/validations/checkout";
import { formatArs } from "@/lib/utils/currency";
import { getBrowserMarketingContext } from "@/lib/marketing/client";

type ProductWithImages = Product & { images: ProductImage[] };
type SettingsWithRule = Omit<StoreSettings, "bankTransferDiscountPercentage"> & {
  bankTransferDiscountPercentage: number;
  activeShippingRule: (ShippingRule & { provinces: ShippingRuleProvince[] }) | null;
};

type CheckoutPageProps = {
  products: ProductWithImages[];
  settings: SettingsWithRule;
  mercadoPagoEnabled: boolean;
  initialProvince?: string;
  initialEmail?: string;
};

type CouponPreview = {
  couponId: string;
  couponCode: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountPercentage: number | null;
  fixedDiscountArs: number | null;
  discountArs: number;
  subtotalWithDiscountArs: number;
};

type FieldShellProps = {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

type ErrorSummaryProps = {
  messages: Array<{ label: string; message?: string }>;
  className?: string;
};

const LEGACY_CHECKOUT_MESSAGE =
  "Podes comprar por debajo del minimo, pero en ese caso se agrega envio segun la configuracion vigente.";

function normalizeCheckoutMessage(message: string | null | undefined) {
  if (!message) {
    return null;
  }

  if (message === LEGACY_CHECKOUT_MESSAGE) {
    return "Podés comprar por debajo del mínimo, pero en ese caso se agrega envío según la configuración vigente.";
  }

  return message;
}

function formatCheckoutProductLabel(label: string) {
  const normalizedLabel = label.trim();

  if (normalizedLabel.toUpperCase() === "MANI") {
    return "Maní";
  }

  return normalizedLabel;
}

function FieldShell({ label, error, className, children }: FieldShellProps) {
  return (
    <label
      className={`block space-y-2 ${
        error ? "[&_input]:border-red-400 [&_input]:bg-red-50/30 [&_select]:border-red-400 [&_select]:bg-red-50/30" : ""
      } ${className ?? ""}`}
    >
      <span className={`text-xs font-extrabold uppercase tracking-[0.16em] ${error ? "text-red-600" : "text-brand-ink/55"}`}>
        {label}
      </span>
      {children}
      <p className={`min-h-4 text-[11px] font-semibold leading-4 ${error ? "text-red-600" : "text-transparent"}`}>
        {error}
      </p>
    </label>
  );
}

function ErrorSummary({ messages, className }: ErrorSummaryProps) {
  const invalidMessages = messages.filter((entry): entry is { label: string; message: string } => Boolean(entry.message));

  if (invalidMessages.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700 ${className ?? ""}`}
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>Revisá los campos marcados en rojo.</p>
    </div>
  );
}

export function CheckoutPage({
  products,
  settings,
  mercadoPagoEnabled,
  initialProvince: requestedProvince,
  initialEmail = "",
}: CheckoutPageProps) {
  const router = useRouter();
  const [checkoutRequestKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponPreview | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isApplyingCoupon, startApplyingCoupon] = useTransition();
  const hasTrackedCheckoutRef = useRef(false);
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const allowBankTransfer = settings.enableBankTransfer;
  const allowMercadoPago = settings.enableMercadoPago && mercadoPagoEnabled;
  const checkoutMessage = normalizeCheckoutMessage(settings.checkoutMessage);
  const initialProvince = requestedProvince && ARGENTINA_PROVINCES.some((province) => province.name === requestedProvince)
    ? requestedProvince
    : "Buenos Aires";

  const productItems = useMemo(
    () =>
      items
        .map((item) => ({
          ...item,
          product: products.find((product) => product.id === item.productId),
        }))
        .filter((entry): entry is typeof entry & { product: ProductWithImages } => Boolean(entry.product)),
    [items, products],
  );
  const suggestedProducts = useMemo(() => {
    const selectedProductIds = new Set(items.map((item) => item.productId));

    return products
      .filter((product) => {
        const productLabel = `${product.homeVarietyLabel ?? ""} ${product.name}`.toLocaleLowerCase("es");
        return !selectedProductIds.has(product.id) && !product.manualSoldOut && !productLabel.includes("mix");
      })
      .slice(0, 3);
  }, [items, products]);

  const form = useForm<CheckoutCustomerInput>({
    resolver: zodResolver(checkoutCustomerSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: initialEmail,
      phone: "",
      province: initialProvince,
      locality: "",
      postalCode: "",
      addressLine: "",
      addressNumber: "",
      addressWithoutNumber: false,
      addressExtra: "",
      couponCode: "",
      checkoutRequestKey,
      paymentMethod: "BANK_TRANSFER",
      notes: "",
    },
  });

  const errors = form.formState.errors;
  const province = form.watch("province");
  const paymentMethod = form.watch("paymentMethod");
  const watchedAddressLine = form.watch("addressLine");
  const watchedAddressNumber = form.watch("addressNumber");
  const watchedAddressWithoutNumber = form.watch("addressWithoutNumber");
  const watchedAddressExtra = form.watch("addressExtra");
  const watchedLocality = form.watch("locality");
  const watchedPostalCode = form.watch("postalCode");
  const subtotal = productItems.reduce((acc, item) => acc + item.product.priceArs * item.quantity, 0);
  const shippingQuote = calculateShippingQuote(subtotal, province, settings);
  const couponDiscountArs = appliedCoupon?.discountArs ?? 0;
  const pricing = calculateCheckoutPricing({
    paymentMethod,
    subtotalArs: subtotal,
    couponDiscountArs,
    shippingArs: shippingQuote.shippingArs,
    enableBankTransferDiscount: settings.enableBankTransferDiscount,
    bankTransferDiscountPercentage: Number(settings.bankTransferDiscountPercentage ?? 0),
  });
  const amountToFreeShipping = Math.max(0, settings.freeShippingThreshold - subtotal);
  const amountToShippingDiscount = shippingQuote.shippingDiscountThresholdArs
    ? Math.max(0, shippingQuote.shippingDiscountThresholdArs - subtotal)
    : 0;
  const checkoutShippingNudge = shippingQuote.freeShippingReached
    ? "Ya tenés envío gratis. Sumá otro sabor y dejá más días de la semana resueltos."
    : shippingQuote.shippingDiscountReached
      ? `Tenés ${shippingQuote.shippingDiscountPercentage}% off en el envío. Si llegás a ${formatArs(settings.freeShippingThreshold)}, el envío es gratis.`
      : amountToShippingDiscount > 0 && shippingQuote.shippingDiscountPercentage > 0
        ? `Sumá un producto más y activa ${shippingQuote.shippingDiscountPercentage}% off en el envío.`
        : `Sumá un segundo sabor para llegar al envío gratis. Te faltan ${formatArs(amountToFreeShipping)}.`;
  const addressPreview = useMemo(() => {
    const formattedStreet = [
      watchedAddressLine?.trim(),
      watchedAddressWithoutNumber ? "s/n" : watchedAddressNumber?.trim(),
    ]
      .filter(Boolean)
      .join(" ");
    const addressParts = [
      formattedStreet,
      watchedAddressExtra?.trim(),
      watchedLocality?.trim(),
      province?.trim(),
      watchedPostalCode?.trim(),
      "Argentina",
    ].filter(Boolean);
    const hasRequiredAddressFields = Boolean(
      watchedAddressLine?.trim() &&
        (watchedAddressWithoutNumber || watchedAddressNumber?.trim()) &&
        watchedLocality?.trim() &&
        province?.trim() &&
        watchedPostalCode?.trim(),
    );
    const hasAddressErrors = Boolean(
      errors.addressLine || errors.addressNumber || errors.locality || errors.postalCode || errors.province,
    );

    if (!hasRequiredAddressFields) {
      return null;
    }

    const query = addressParts.join(", ");

    return {
      query,
      hasAddressErrors,
      mapsHref: `https://www.google.com/maps?q=${encodeURIComponent(query)}`,
      embedSrc: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`,
    };
  }, [
    errors.addressLine,
    errors.addressNumber,
    errors.locality,
    errors.postalCode,
    errors.province,
    province,
    watchedAddressExtra,
    watchedAddressLine,
    watchedAddressNumber,
    watchedAddressWithoutNumber,
    watchedLocality,
    watchedPostalCode,
  ]);

  useEffect(() => {
    if (paymentMethod === "MERCADO_PAGO" && !allowMercadoPago && allowBankTransfer) {
      form.setValue("paymentMethod", "BANK_TRANSFER");
    }

    if (paymentMethod === "BANK_TRANSFER" && !allowBankTransfer && allowMercadoPago) {
      form.setValue("paymentMethod", "MERCADO_PAGO");
    }
  }, [allowBankTransfer, allowMercadoPago, form, paymentMethod]);

  useEffect(() => {
    if (!appliedCoupon) {
      return;
    }

    void refreshCoupon(appliedCoupon.couponCode, false);
  }, [appliedCoupon, subtotal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasTrackedCheckoutRef.current) {
      return;
    }

    const itemCount = items.reduce((totalItems, item) => totalItems + item.quantity, 0);

    if (itemCount === 0) {
      return;
    }

    const storageKey = `meta:initiate_checkout:${checkoutRequestKey}`;

    if (typeof window !== "undefined" && window.sessionStorage.getItem(storageKey)) {
      hasTrackedCheckoutRef.current = true;
      return;
    }

    trackMetaEvent("InitiateCheckout", {
      value: pricing.totalArs,
      currency: "ARS",
      num_items: itemCount,
    });

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, "1");
    }

    hasTrackedCheckoutRef.current = true;
  }, [checkoutRequestKey, items, pricing.totalArs]);

  async function refreshCoupon(code: string, updateInput = true) {
    const response = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        subtotalArs: subtotal,
        taxId: form.getValues("taxId") ?? "",
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setAppliedCoupon(null);
      setCouponError(payload.error ?? "No pudimos validar el cupón.");
      form.setValue("couponCode", "");
      return;
    }

    setAppliedCoupon(payload.data);
    setCouponError(null);
    form.setValue("couponCode", payload.data.couponCode);

    if (updateInput) {
      setCouponInput(payload.data.couponCode);
    }
  }

  if (productItems.length === 0) {
    return (
      <EmptyState
        title="No hay productos en el checkout"
        description="Primero agrega al menos una caja al carrito para continuar."
        actionHref="/#productos"
        actionLabel="Volver a productos"
      />
    );
  }

  return (
    <form
      className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]"
      onSubmit={form.handleSubmit((values) => {
        setError(null);
        startTransition(async () => {
          trackEvent("add_payment_info", {
            currency: "ARS",
            value: pricing.totalArs,
            payment_type: values.paymentMethod,
            coupon: appliedCoupon?.couponCode,
            items: productItems.map((item) => ({
              item_id: item.product.id,
              item_name: item.product.name,
              item_category: "Productos",
              price: item.product.priceArs,
              quantity: item.quantity,
            })),
          });

          const response = await fetch("/api/orders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...values,
              couponCode: appliedCoupon?.couponCode ?? "",
              marketing: getBrowserMarketingContext() ?? undefined,
              items: productItems.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
              })),
            }),
          });

          const payload = await response.json();

          if (!response.ok) {
            setError(payload.error ?? "No pudimos generar el pedido.");
            return;
          }

          if (payload.data.paymentMethod === "MERCADO_PAGO" && payload.data.mercadoPago?.initPoint) {
            window.location.assign(payload.data.mercadoPago.initPoint);
            return;
          }

          router.push(`/checkout/transfer/${payload.data.orderNumber}`);
        });
      })}
    >
      <TrackEventOnView
        eventName="begin_checkout"
        dedupeKey={`begin_checkout:${checkoutRequestKey}`}
        params={{
          currency: "ARS",
          value: pricing.totalArs,
          coupon: appliedCoupon?.couponCode,
          items: productItems.map((item) => ({
            item_id: item.product.id,
            item_name: item.product.name,
            item_category: "Productos",
            price: item.product.priceArs,
            quantity: item.quantity,
          })),
        }}
      />
      <Card className="order-2 space-y-5 p-5 md:p-6 lg:order-1">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Paso 1 de 2</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-4xl">Completa tu compra</h1>
          <p className="mt-2 text-sm leading-6 text-brand-ink/70 md:text-base">
            Cargá tus datos, elegí el medio de pago y generamos tu pedido.
          </p>
        </div>

        <div className="grid gap-x-4 gap-y-3 md:grid-cols-3">
          <div className="md:col-span-3">
            <p className="text-sm font-extrabold text-brand-ink">Tus datos</p>
            <p className="mt-1 text-sm text-brand-ink/60">Los usamos para confirmar y preparar tu pedido.</p>
          </div>
          <ErrorSummary
            className="md:col-span-3"
            messages={[
              { label: "Nombre", message: errors.firstName?.message },
              { label: "Apellido", message: errors.lastName?.message },
              { label: "Documento", message: errors.taxId?.message },
              { label: "Email", message: errors.email?.message },
              { label: "Telefono", message: errors.phone?.message },
            ]}
          />
          <FieldShell label="Nombre" error={errors.firstName?.message}>
            <Input
              placeholder="Ej: Maria"
              autoComplete="given-name"
              aria-invalid={errors.firstName ? "true" : "false"}
              {...form.register("firstName")}
            />
          </FieldShell>
          <FieldShell label="Apellido" error={errors.lastName?.message}>
            <Input
              placeholder="Ej: Gonzalez"
              autoComplete="family-name"
              aria-invalid={errors.lastName ? "true" : "false"}
              {...form.register("lastName")}
            />
          </FieldShell>
          <FieldShell
            label="Documento o DNI"
            error={errors.taxId?.message}
          >
            <Input
              placeholder="Ej: 30123456"
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={errors.taxId ? "true" : "false"}
              {...form.register("taxId")}
            />
          </FieldShell>
          <FieldShell label="Email" error={errors.email?.message} className="md:col-span-2">
            <Input
              placeholder="nombre@dominio.com"
              type="email"
              autoComplete="email"
              inputMode="email"
              aria-invalid={errors.email ? "true" : "false"}
              {...form.register("email")}
            />
          </FieldShell>
          <FieldShell label="Teléfono" error={errors.phone?.message}>
            <Input
              placeholder="Ej: 11 4567 8901"
              autoComplete="tel"
              inputMode="tel"
              aria-invalid={errors.phone ? "true" : "false"}
              {...form.register("phone")}
            />
          </FieldShell>
        </div>

        <section className="border-t border-brand-ink/10 pt-5">
          <div className="mb-4">
            <p className="text-sm font-extrabold text-brand-ink">Datos de entrega</p>
            <p className="mt-1 text-sm text-brand-ink/60">Completalos tal como deben figurar en el envio.</p>
          </div>
          <ErrorSummary
            className="mb-4"
            messages={[
              { label: "Provincia", message: errors.province?.message },
              { label: "Localidad", message: errors.locality?.message },
              { label: "Codigo postal", message: errors.postalCode?.message },
              { label: "Calle", message: errors.addressLine?.message },
              { label: "Altura", message: errors.addressNumber?.message },
              { label: "Piso / Depto", message: errors.addressExtra?.message },
              { label: "Observaciones", message: errors.notes?.message },
            ]}
          />
          <div className="grid gap-x-4 gap-y-3 md:grid-cols-3">
          <FieldShell label="Provincia" error={errors.province?.message}>
            <Select
              autoComplete="address-level1"
              aria-invalid={errors.province ? "true" : "false"}
              {...form.register("province")}
            >
              {ARGENTINA_PROVINCES.map((provinceOption) => (
                <option key={provinceOption.code} value={provinceOption.name}>
                  {provinceOption.name}
                </option>
              ))}
            </Select>
          </FieldShell>
          <FieldShell label="Localidad" error={errors.locality?.message}>
            <Input
              placeholder="Ej: Vicente López"
              autoComplete="address-level2"
              aria-invalid={errors.locality ? "true" : "false"}
              {...form.register("locality")}
            />
          </FieldShell>
          <FieldShell label="Código postal" error={errors.postalCode?.message}>
            <Input
              placeholder="Ej: 1425"
              autoComplete="postal-code"
              inputMode="numeric"
              aria-invalid={errors.postalCode ? "true" : "false"}
              {...form.register("postalCode")}
            />
          </FieldShell>
          <FieldShell
            label="Calle"
            error={errors.addressLine?.message}
            className={watchedAddressWithoutNumber ? "md:col-span-3" : "md:col-span-2"}
          >
            <Input
              placeholder="Ej: Amenabar"
              autoComplete="address-line1"
              aria-invalid={errors.addressLine ? "true" : "false"}
              {...form.register("addressLine")}
            />
          </FieldShell>
          {!watchedAddressWithoutNumber ? (
            <FieldShell label="Altura" error={errors.addressNumber?.message}>
              <Input
                placeholder="Ej: 2451"
                autoComplete="off"
                inputMode="numeric"
                aria-invalid={errors.addressNumber ? "true" : "false"}
                {...form.register("addressNumber")}
              />
            </FieldShell>
          ) : null}
          <label className="group md:col-span-3 -mt-1 inline-flex w-fit cursor-pointer items-center gap-2 text-left focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-pink focus-within:ring-offset-2">
            <input
              type="checkbox"
              className="peer sr-only"
              {...form.register("addressWithoutNumber", {
                onChange: (event) => {
                  if (event.target.checked) {
                    form.setValue("addressNumber", "", { shouldDirty: true, shouldValidate: true });
                    form.clearErrors("addressNumber");
                  }
                },
              })}
            />
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-brand-ink/30 bg-white text-white transition-colors peer-checked:border-brand-pink peer-checked:bg-brand-pink">
              <CheckCircle2
                className={`h-3 w-3 transition-opacity ${watchedAddressWithoutNumber ? "opacity-100" : "opacity-0"}`}
              />
            </span>
            <span className="text-sm font-semibold text-brand-ink/70">La calle no tiene altura</span>
          </label>
          <FieldShell label="Piso / Depto" error={errors.addressExtra?.message} className="md:col-span-3">
            <Input
              placeholder="Ej: Piso 4 Depto B"
              autoComplete="address-line2"
              aria-invalid={errors.addressExtra ? "true" : "false"}
              {...form.register("addressExtra")}
            />
          </FieldShell>

          {addressPreview ? (
            <div className="md:col-span-3">
              <div className="overflow-hidden rounded-[1.75rem] border border-brand-ink/10 bg-white shadow-card">
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-brand-pink/10 p-2 text-brand-pink">
                      <MapPinned className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink/46">Ubicación</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-brand-ink/78">{addressPreview.query}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-brand-ink/62">
                    {addressPreview.hasAddressErrors
                      ? "Revisá calle, altura, localidad o código postal para ubicar mejor el destino."
                      : "Si no coincide, modificá la calle, altura o dejanos una aclaración en observaciones."}
                  </p>
                </div>
                <div className="border-t border-brand-ink/10 bg-[#f8f6f4] p-2">
                  <div className="relative overflow-hidden rounded-[1.4rem] border border-brand-ink/10 bg-white">
                    <iframe
                      title="Vista previa del destino"
                      src={addressPreview.embedSrc}
                      className="pointer-events-none h-[280px] w-full"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                    <div className="absolute inset-0 z-10" aria-hidden="true" />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="md:col-span-3">
            <FieldShell label="Observaciones" error={errors.notes?.message}>
              <Textarea
                placeholder="Ej: Timbre roto. Tocar portería. Recibe Lucía por la tarde."
                aria-invalid={errors.notes ? "true" : "false"}
                {...form.register("notes")}
              />
            </FieldShell>
          </div>
          </div>
        </section>

        <PaymentMethodSelector
          value={form.watch("paymentMethod")}
          mercadoPagoEnabled={allowMercadoPago}
          bankTransferEnabled={allowBankTransfer}
          bankTransferDiscountPercentage={pricing.paymentMethodDiscountPercentage}
          onChange={(nextPaymentMethod) => form.setValue("paymentMethod", nextPaymentMethod, { shouldDirty: true })}
        />
        {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending
            ? paymentMethod === "MERCADO_PAGO"
              ? "Redirigiendo..."
              : "Generando pedido..."
            : paymentMethod === "MERCADO_PAGO"
              ? "Avanzar con el pago"
              : "Continuar con transferencia"}
        </Button>
      </Card>

      <Card className="order-1 h-fit space-y-5 p-5 md:p-6 lg:order-2 lg:sticky lg:top-28">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Resumen</p>
        </div>
        <div className="space-y-2 text-sm text-brand-ink/70">
          {productItems.map((item) => (
            <div key={item.productId} className="flex items-start justify-between gap-3">
              <span className="pr-2">
                {item.product.name} x {item.quantity}
              </span>
              <span className="shrink-0">{formatArs(item.product.priceArs * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="rounded-[1.5rem] border border-brand-ink/10 bg-background p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-brand-pink/10 p-2 text-brand-pink">
              <TicketPercent className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-brand-ink">Código de descuento</p>
              <p className="mt-1 text-sm text-brand-ink/60">Aplicalo antes de confirmar tu pedido.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Input
              value={couponInput}
              maxLength={40}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Ej: MICA10"
              onChange={(event) => {
                const nextValue = event.target.value.toUpperCase();
                setCouponInput(nextValue);
                setCouponError(null);

                if (appliedCoupon && nextValue.trim() !== appliedCoupon.couponCode) {
                  setAppliedCoupon(null);
                  form.setValue("couponCode", "");
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              className="sm:min-w-[132px]"
              disabled={isApplyingCoupon || couponInput.trim().length < 3}
              onClick={() => {
                setCouponError(null);
                startApplyingCoupon(async () => {
                  await refreshCoupon(couponInput);
                });
              }}
            >
              {isApplyingCoupon ? "Validando..." : "Aplicar"}
            </Button>
          </div>

          {appliedCoupon ? (
            <div className="mt-4 rounded-[1.25rem] bg-green-50 p-4 text-sm text-green-800">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-bold">Cupón {appliedCoupon.couponCode} aplicado</p>
                    <p className="mt-1">
                      Descuento:{" "}
                      {getCouponDiscountLabel({
                        discountType: appliedCoupon.discountType,
                        discountPercentage: appliedCoupon.discountPercentage,
                        fixedDiscountArs: appliedCoupon.fixedDiscountArs,
                      })}{" "}
                      ({formatArs(appliedCoupon.discountArs)})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-left font-bold text-green-800 underline underline-offset-2 sm:text-right"
                  onClick={() => {
                    setAppliedCoupon(null);
                    setCouponInput("");
                    setCouponError(null);
                    form.setValue("couponCode", "");
                  }}
                >
                  Quitar
                </button>
              </div>
            </div>
          ) : null}

          {couponError ? <p className="mt-3 text-sm font-bold text-red-600">{couponError}</p> : null}
        </div>

        <div className="space-y-3 border-t border-brand-ink/10 pt-4 text-sm text-brand-ink/70">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-bold text-brand-ink">{formatArs(subtotal)}</span>
          </div>
          {appliedCoupon ? (
            <div className="flex items-center justify-between">
              <span>
                Descuento{" "}
                {getCouponDiscountLabel({
                  discountType: appliedCoupon.discountType,
                  discountPercentage: appliedCoupon.discountPercentage,
                  fixedDiscountArs: appliedCoupon.fixedDiscountArs,
                })}
              </span>
              <span className="font-bold text-green-700">- {formatArs(appliedCoupon.discountArs)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span>Envío</span>
            {shippingQuote.freeShippingReached ? (
              <span className="font-bold text-emerald-700">Gratis</span>
            ) : shippingQuote.shippingDiscountReached ? (
              <span className="flex items-center gap-2 font-bold">
                <span className="text-brand-ink/35 line-through">{formatArs(shippingQuote.baseShippingArs)}</span>
                <span className="text-emerald-700">{formatArs(pricing.shippingArs)}</span>
              </span>
            ) : (
              <span className="font-bold text-brand-ink">{formatArs(pricing.shippingArs)}</span>
            )}
          </div>
          {pricing.paymentMethodDiscountArs > 0 ? (
            <div className="flex items-center justify-between">
              <span>Descuento transferencia ({pricing.paymentMethodDiscountPercentage}%)</span>
              <span className="font-bold text-green-700">- {formatArs(pricing.paymentMethodDiscountArs)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-brand-ink/10 pt-3">
            <span>Total</span>
            <span className="text-2xl font-extrabold text-brand-pink md:text-3xl">{formatArs(pricing.totalArs)}</span>
          </div>
        </div>

        <div className="space-y-4 border-t border-brand-ink/10 pt-4">
          <p className="text-sm font-bold leading-6 text-emerald-700">{checkoutShippingNudge}</p>

          {suggestedProducts.length > 0 ? (
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/50">Otros sabores</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {suggestedProducts.map((product) => {
                  const image = product.images.find((entry) => entry.isPrimary) ?? product.images[0];
                  const productLabel = product.homeVarietyLabel?.trim() || product.name;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      className="group flex min-w-0 flex-col items-center rounded-[1.1rem] border border-brand-ink/10 bg-white p-2 text-center transition hover:-translate-y-0.5 hover:border-brand-pink/40 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/50"
                      aria-label={`Agregar ${productLabel} al carrito`}
                      onClick={() => {
                        addItem(product.id, 1);
                        announceCartItemAdded({ productName: product.name, quantity: 1 });
                        trackAddToCart({
                          productId: product.id,
                          productName: product.name,
                          priceArs: product.priceArs,
                          quantity: 1,
                        });
                      }}
                    >
                      <span className="relative h-14 w-full overflow-hidden rounded-[0.8rem] bg-background">
                        <img
                          src={image?.publicUrl ?? productFallbackImageMap[product.colorTheme]}
                          alt=""
                          className="absolute inset-0 h-full w-full object-contain p-1 transition-transform group-hover:scale-105"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = productFallbackImageMap[product.colorTheme];
                          }}
                        />
                      </span>
                      <span className="mt-2 line-clamp-1 max-w-full text-xs font-extrabold uppercase tracking-[0.08em] text-brand-ink">
                        {formatCheckoutProductLabel(productLabel)}
                      </span>
                      <span className="mt-1 text-[11px] font-semibold text-brand-ink/55">{formatArs(product.priceArs)}</span>
                      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold text-brand-pink">
                        <Plus className="h-3 w-3" /> Agregar
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-[1.5rem] bg-brand-peach p-4 text-sm text-brand-ink/70">
          <p>{checkoutMessage || "Completas tus datos ahora y el pago se hace en el siguiente paso."}</p>
          <p className="mt-2">Envío gratis desde {formatArs(settings.freeShippingThreshold)}.</p>
        </div>
      </Card>
    </form>
  );
}
