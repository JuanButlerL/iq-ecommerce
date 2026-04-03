"use client";

import { ArrowRight, ShieldCheck, Truck } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Product, ProductImage, ShippingRule, ShippingRuleProvince, StoreSettings } from "@prisma/client";

import { MercadoPagoLogo } from "@/components/brand/mercado-pago-logo";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { calculateShippingQuote } from "@/features/cart/lib/shipping";
import { useCartStore } from "@/features/cart/store";
import { ARGENTINA_PROVINCES } from "@/lib/constants/provinces";
import { checkoutCustomerSchema, type CheckoutCustomerInput } from "@/lib/validations/checkout";
import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";

type ProductWithImages = Product & { images: ProductImage[] };
type SettingsWithRule = StoreSettings & {
  activeShippingRule: (ShippingRule & { provinces: ShippingRuleProvince[] }) | null;
};

type CheckoutPageProps = {
  products: ProductWithImages[];
  settings: SettingsWithRule;
  mercadoPagoEnabled: boolean;
};

export function CheckoutPage({ products, settings, mercadoPagoEnabled }: CheckoutPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const items = useCartStore((state) => state.items);

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

  const form = useForm<CheckoutCustomerInput>({
    resolver: zodResolver(checkoutCustomerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      province: "Buenos Aires",
      locality: "",
      postalCode: "",
      addressLine: "",
      addressExtra: "",
      notes: "",
      paymentMethod: mercadoPagoEnabled ? "MERCADO_PAGO" : "BANK_TRANSFER",
    },
  });

  const province = form.watch("province");
  const paymentMethod = form.watch("paymentMethod");
  const subtotal = productItems.reduce((acc, item) => acc + item.product.priceArs * item.quantity, 0);
  const shippingQuote = calculateShippingQuote(subtotal, province, settings);
  const total = subtotal + shippingQuote.shippingArs;

  if (productItems.length === 0) {
    return (
      <EmptyState
        title="No hay productos en el checkout"
        description="Primero agrega al menos una caja al carrito para continuar."
        actionHref="/productos"
        actionLabel="Volver a productos"
      />
    );
  }

  return (
    <form
      className="grid gap-8 lg:grid-cols-[1.16fr_0.84fr]"
      onSubmit={form.handleSubmit((values) => {
        setError(null);
        startTransition(async () => {
          const response = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...values,
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

          if (payload.data.paymentMethod === "MERCADO_PAGO") {
            if (!payload.data.paymentCheckoutUrl) {
              setError("No pudimos iniciar Mercado Pago para este pedido.");
              return;
            }

            window.location.assign(payload.data.paymentCheckoutUrl);
            return;
          }

          window.location.assign(`/checkout/transfer/${payload.data.orderNumber}`);
        });
      })}
    >
      <Card className="order-2 p-6 md:p-8 lg:order-1">
        <div className="space-y-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-brand-ink/40">Checkout</p>
            <h1 className="mt-1 text-3xl font-semibold text-brand-ink">Completa tu compra</h1>
          </div>

          <CheckoutSection step={1} title="Datos de contacto">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nombre" error={form.formState.errors.firstName?.message}>
                <Input placeholder="Ej. Maria" {...form.register("firstName")} />
              </Field>
              <Field label="Apellido" error={form.formState.errors.lastName?.message}>
                <Input placeholder="Ej. Gonzalez" {...form.register("lastName")} />
              </Field>
              <Field label="Email" error={form.formState.errors.email?.message}>
                <Input type="email" placeholder="tu@email.com" {...form.register("email")} />
              </Field>
              <Field label="Telefono" error={form.formState.errors.phone?.message}>
                <Input type="tel" placeholder="Ej. 11 1234-5678" {...form.register("phone")} />
              </Field>
            </div>
          </CheckoutSection>

          <CheckoutSection step={2} title="Direccion de envio">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Provincia" error={form.formState.errors.province?.message}>
                <Select {...form.register("province")}>
                  {ARGENTINA_PROVINCES.map((p) => (
                    <option key={p.code} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Localidad" error={form.formState.errors.locality?.message}>
                <Input placeholder="Ej. Palermo" {...form.register("locality")} />
              </Field>
              <Field label="Codigo postal" error={form.formState.errors.postalCode?.message}>
                <Input placeholder="Ej. 1425" {...form.register("postalCode")} />
              </Field>
              <Field label="Direccion" error={form.formState.errors.addressLine?.message}>
                <Input placeholder="Calle y numero" {...form.register("addressLine")} />
              </Field>
              <Field label="Piso / Dpto (opcional)" error={form.formState.errors.addressExtra?.message} className="md:col-span-2">
                <Input placeholder="Ej. 3 B" {...form.register("addressExtra")} />
              </Field>
              <Field label="Notas para el pedido (opcional)" error={form.formState.errors.notes?.message} className="md:col-span-2">
                <Textarea placeholder="Instrucciones de entrega, horarios, etc." {...form.register("notes")} />
              </Field>
            </div>
          </CheckoutSection>

          <CheckoutSection step={3} title="Medio de pago">
            <div className="space-y-3">
              {mercadoPagoEnabled && (
                <PaymentCard
                  selected={paymentMethod === "MERCADO_PAGO"}
                  onSelect={() => form.setValue("paymentMethod", "MERCADO_PAGO", { shouldValidate: true })}
                  logo={<MercadoPagoLogo />}
                  description="Tarjeta de credito, debito, saldo MP y mas"
                  badges={<CardBadges />}
                />
              )}

              <PaymentCard
                selected={paymentMethod === "BANK_TRANSFER"}
                onSelect={() => form.setValue("paymentMethod", "BANK_TRANSFER", { shouldValidate: true })}
                logo={
                  <span className="flex items-center gap-2">
                    <BankIcon />
                    <span className="text-sm font-semibold text-brand-ink">Transferencia bancaria</span>
                  </span>
                }
                description="Transferi por CBU o alias y subi el comprobante"
              />
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-brand-ink/[0.04] px-4 py-3 text-sm text-brand-ink/60">
              {paymentMethod === "MERCADO_PAGO" ? (
                <>
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#009ee3]" />
                  <p>Seras redirigido a Mercado Pago para completar el pago de forma segura.</p>
                </>
              ) : (
                <>
                  <Truck className="mt-0.5 h-4 w-4 shrink-0 text-brand-pink" />
                  <p>Despues de confirmar, te mostramos el alias y CBU para que realices la transferencia.</p>
                </>
              )}
            </div>
          </CheckoutSection>

          <div className="flex items-start gap-2 rounded-2xl border border-brand-ink/10 bg-background px-4 py-3 text-sm text-brand-ink/55">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-pink" />
            <p>{settings.checkoutMessage || "Tus datos se usan unicamente para procesar tu pedido."}</p>
          </div>

          {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</p> : null}

          <Button type="submit" className="w-full gap-2" size="lg" disabled={isPending}>
            {isPending
              ? "Preparando tu compra..."
              : paymentMethod === "MERCADO_PAGO"
                ? "Continuar a Mercado Pago"
                : "Confirmar pedido"}
            {!isPending ? <ArrowRight className="h-4 w-4" /> : null}
          </Button>
        </div>
      </Card>

      <Card className="order-1 h-fit p-6 md:p-8 lg:order-2 lg:sticky lg:top-28">
        <p className="mb-4 text-sm font-semibold text-brand-ink">Resumen de compra</p>

        <div className="space-y-3">
          {productItems.map((item) => (
            <div key={item.productId} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-brand-ink/70">
                {item.product.name}
                <span className="ml-1 text-brand-ink/40">x{item.quantity}</span>
              </span>
              <span className="shrink-0 font-medium text-brand-ink">{formatArs(item.product.priceArs * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-3 border-t border-brand-ink/10 pt-4 text-sm">
          <div className="flex items-center justify-between text-brand-ink/60">
            <span>Subtotal</span>
            <span className="font-medium text-brand-ink">{formatArs(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-brand-ink/60">
            <span>Envio</span>
            <span className="font-medium text-brand-ink">
              {shippingQuote.shippingArs === 0 ? "Gratis" : formatArs(shippingQuote.shippingArs)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-brand-ink/10 pt-3">
            <span className="font-semibold text-brand-ink">Total</span>
            <span className="text-2xl font-semibold text-brand-ink">{formatArs(total)}</span>
          </div>
        </div>

        {settings.freeShippingThreshold > 0 && shippingQuote.shippingArs > 0 ? (
          <p className="mt-3 text-xs text-brand-ink/40">Envio gratis en compras desde {formatArs(settings.freeShippingThreshold)}.</p>
        ) : null}
      </Card>
    </form>
  );
}

function CheckoutSection({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-pink text-xs font-bold text-white">
          {step}
        </span>
        <h2 className="text-base font-semibold text-brand-ink">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-sm font-medium text-brand-ink/70">{label}</label>
      {children}
      {error ? <p className="text-xs font-medium text-red-500">{error}</p> : null}
    </div>
  );
}

type PaymentCardProps = {
  selected: boolean;
  onSelect: () => void;
  logo: React.ReactNode;
  description: string;
  badges?: React.ReactNode;
};

function PaymentCard({ selected, onSelect, logo, description, badges }: PaymentCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-4 rounded-2xl border px-4 py-4 text-left transition",
        selected ? "border-brand-ink/50 bg-white shadow-sm" : "border-brand-ink/10 bg-white hover:border-brand-ink/25",
      )}
    >
      <span
        className={cn(
          "mt-1 flex h-5 w-5 shrink-0 rounded-full border-2 transition",
          selected ? "border-brand-ink/60" : "border-brand-ink/20",
        )}
      >
        {selected ? <span className="m-auto h-2.5 w-2.5 rounded-full bg-brand-ink/60" /> : null}
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex items-center">{logo}</span>
        <span className="text-xs text-brand-ink/50">{description}</span>
        {badges}
      </span>
    </button>
  );
}

function CardBadges() {
  return (
    <span className="flex flex-col gap-2.5 pt-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-ink/35">Paga con</span>
      <span className="flex flex-wrap items-center gap-2.5">
        <VisaIcon />
        <MastercardIcon />
        <AmexIcon />
        <NaranjaIcon />
        <CabalIcon />
      </span>
    </span>
  );
}

function CardIcon({ children, bg = "#fff" }: { children: React.ReactNode; bg?: string }) {
  return (
    <span
      className="flex h-9 w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-black/[0.08] shadow-[0_1px_2px_rgba(16,24,40,0.06)]"
      style={{ backgroundColor: bg }}
    >
      {children}
    </span>
  );
}

function VisaIcon() {
  return (
    <CardIcon bg="#fff">
      <svg viewBox="0 0 52 32" className="h-[28px] w-[50px]" aria-label="Visa">
        <path
          d="M19.2 21.3 21.6 10.7H25L22.6 21.3H19.2ZM33.5 11C32.8 10.7 31.7 10.4 30.3 10.4 27 10.4 24.6 12.1 24.6 14.5 24.6 16.3 26.2 17.3 27.5 17.9 28.8 18.5 29.2 18.9 29.2 19.5 29.2 20.4 28.1 20.8 27.1 20.8 25.7 20.8 25 20.6 23.8 20.1L23.3 19.9 22.8 22.9C23.7 23.3 25.3 23.6 27 23.6 30.5 23.6 32.8 21.9 32.8 19.4 32.8 18 31.9 16.9 30 16.1 28.8 15.5 28.1 15.1 28.1 14.5 28.1 13.9 28.8 13.3 30.3 13.3 31.5 13.3 32.4 13.5 33.1 13.8L33.4 14 33.9 11.1 33.5 11ZM42.5 10.7H39.9C39.1 10.7 38.5 10.9 38.2 11.7L33.4 21.3H36.9L37.6 19.4H41.9C42 19.9 42.3 21.3 42.3 21.3H45.4L42.5 10.7ZM38.6 17C38.9 16.2 40.1 13.2 40.1 13.2 40.1 13.2 40.4 12.4 40.6 11.9L40.8 13.1C40.8 13.1 41.5 16.3 41.7 17H38.6ZM16.1 10.7L12.8 18.3 12.5 16.9C11.9 14.9 10.1 12.8 8.1 11.6L11.1 21.3H14.7L19.8 10.7H16.1Z"
          fill="#1A1F71"
        />
        <path d="M10.1 10.7H4.6L4.5 11C8.8 12 11.6 14.5 12.5 16.9L11.6 11.7C11.5 10.9 10.9 10.7 10.1 10.7Z" fill="#F9A533" />
      </svg>
    </CardIcon>
  );
}

function MastercardIcon() {
  return (
    <CardIcon bg="#fff">
      <svg viewBox="0 0 52 32" className="h-[26px] w-[46px]" aria-label="Mastercard">
        <circle cx="20" cy="16" r="10" fill="#EB001B" />
        <circle cx="32" cy="16" r="10" fill="#F79E1B" />
        <path d="M26 8.1a10 10 0 0 1 0 15.8A10 10 0 0 1 26 8.1Z" fill="#FF5F00" />
      </svg>
    </CardIcon>
  );
}

function AmexIcon() {
  return (
    <CardIcon bg="#016FD0">
      <svg viewBox="0 0 52 32" className="h-[28px] w-[50px]" aria-label="American Express">
        <rect width="52" height="32" fill="#016FD0" />
        <path
          d="M10 13h4.4l.9 2 .9-2H32c1.3 0 2 .6 2 1.6v1c0 .5-.3.9-.8 1.1.6.2.9.7.9 1.3v1c0 1-.7 1.6-2 1.6H16.2l-.9-2-.9 2H10V13Zm2 1.2v4.4h1.4l1.8-3.9 1.8 3.9h1.4v-4.4h-1.2v3l-1.6-3h-1.8l-1.6 3v-3H12Zm10.2 0v4.4h4.6v-1.1h-3.3v-.7h3.2v-1.1h-3.2v-.6h3.3v-1.1h-4.6Zm5 0 2 2.2-2 2.2h1.6l1.2-1.4 1.2 1.4h1.6l-2-2.2 2-2.2H28.4l-1.2 1.4-1.2-1.4h-1.6Zm7 0v4.4h1.3v-1.3H37c1.1 0 1.7-.6 1.7-1.6 0-1-.6-1.5-1.7-1.5h-2.8Zm1.3 1.1h1.3c.4 0 .6.2.6.5s-.2.5-.6.5h-1.3v-1Z"
          fill="#fff"
        />
      </svg>
    </CardIcon>
  );
}

function NaranjaIcon() {
  return (
    <CardIcon bg="#FF5C00">
      <svg viewBox="0 0 52 32" className="h-[28px] w-[50px]" aria-label="Naranja X">
        <rect width="52" height="32" fill="#FF5C00" />
        <g transform="translate(8, 8)">
          <rect x="0" y="5" width="14" height="3.5" rx="1.5" fill="#fff" transform="rotate(45 7 6.75)" />
          <rect x="0" y="5" width="14" height="3.5" rx="1.5" fill="#fff" transform="rotate(-45 7 6.75)" />
        </g>
        <text x="29" y="20" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="800" fill="#fff" letterSpacing="0.3">
          naranja
        </text>
      </svg>
    </CardIcon>
  );
}

function CabalIcon() {
  return (
    <CardIcon bg="#006FC0">
      <svg viewBox="0 0 52 32" className="h-[28px] w-[50px]" aria-label="Cabal">
        <rect width="52" height="32" fill="#006FC0" />
        <rect x="0" y="22" width="52" height="5" fill="#004E8A" />
        <text x="26" y="18" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="9.5" fontWeight="800" fill="#fff" letterSpacing="1.5">
          CABAL
        </text>
      </svg>
    </CardIcon>
  );
}

function BankIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-5 w-5 text-brand-ink/50"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="10" width="18" height="10" rx="2" />
      <path d="M3 10l9-7 9 7" />
      <line x1="7" y1="10" x2="7" y2="20" />
      <line x1="12" y1="10" x2="12" y2="20" />
      <line x1="17" y1="10" x2="17" y2="20" />
    </svg>
  );
}
