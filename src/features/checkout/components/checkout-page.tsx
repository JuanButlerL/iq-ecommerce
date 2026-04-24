"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Product, ProductImage, ShippingRule, ShippingRuleProvince, StoreSettings } from "@prisma/client";
import { CheckCircle2, TicketPercent } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore } from "@/features/cart/store";
import { calculateCheckoutPricing } from "@/features/checkout/lib/pricing";
import { calculateShippingQuote } from "@/features/cart/lib/shipping";
import { PaymentMethodSelector } from "@/features/checkout/components/payment-method-selector";
import { ARGENTINA_PROVINCES } from "@/lib/constants/provinces";
import { checkoutCustomerSchema, type CheckoutCustomerInput } from "@/lib/validations/checkout";
import { formatArs } from "@/lib/utils/currency";

type ProductWithImages = Product & { images: ProductImage[] };
type SettingsWithRule = Omit<StoreSettings, "bankTransferDiscountPercentage"> & {
  bankTransferDiscountPercentage: number;
  activeShippingRule: (ShippingRule & { provinces: ShippingRuleProvince[] }) | null;
};

type CheckoutPageProps = {
  products: ProductWithImages[];
  settings: SettingsWithRule;
  mercadoPagoEnabled: boolean;
};

type CouponPreview = {
  couponId: string;
  couponCode: string;
  discountPercentage: number;
  discountArs: number;
  subtotalWithDiscountArs: number;
};

export function CheckoutPage({ products, settings, mercadoPagoEnabled }: CheckoutPageProps) {
  const router = useRouter();
  const [checkoutRequestKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponPreview | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isApplyingCoupon, startApplyingCoupon] = useTransition();
  const items = useCartStore((state) => state.items);
  const allowBankTransfer = settings.enableBankTransfer;
  const allowMercadoPago = settings.enableMercadoPago && mercadoPagoEnabled;

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
      couponCode: "",
      checkoutRequestKey,
      paymentMethod: "BANK_TRANSFER",
      notes: "",
    },
  });

  const province = form.watch("province");
  const paymentMethod = form.watch("paymentMethod");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  async function refreshCoupon(code: string, updateInput = true) {
    const response = await fetch("/api/coupons/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        subtotalArs: subtotal,
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
        actionHref="/productos"
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
          const response = await fetch("/api/orders", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...values,
              couponCode: appliedCoupon?.couponCode ?? "",
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
      <Card className="order-2 space-y-5 p-5 md:p-6 lg:order-1">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Paso 1 de 2</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-4xl">Completa tu compra</h1>
          <p className="mt-2 text-sm leading-6 text-brand-ink/70 md:text-base">
            Carga tus datos, elegi el medio de pago y generamos tu pedido.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Input placeholder="Nombre" {...form.register("firstName")} />
          <Input placeholder="Apellido" {...form.register("lastName")} />
          <Input placeholder="Email" {...form.register("email")} />
          <Input placeholder="Telefono" {...form.register("phone")} />
          <Select {...form.register("province")}>
            {ARGENTINA_PROVINCES.map((provinceOption) => (
              <option key={provinceOption.code} value={provinceOption.name}>
                {provinceOption.name}
              </option>
            ))}
          </Select>
          <Input placeholder="Localidad" {...form.register("locality")} />
          <Input placeholder="Codigo postal" {...form.register("postalCode")} />
          <Input placeholder="Direccion" {...form.register("addressLine")} />
          <Input placeholder="Piso / Depto" className="md:col-span-2" {...form.register("addressExtra")} />
          <div className="md:col-span-2">
            <Textarea placeholder="Observaciones" {...form.register("notes")} />
          </div>
        </div>
        <PaymentMethodSelector
          value={form.watch("paymentMethod")}
          mercadoPagoEnabled={allowMercadoPago}
          bankTransferEnabled={allowBankTransfer}
          bankTransferDiscountPercentage={pricing.paymentMethodDiscountPercentage}
          onChange={(paymentMethod) => form.setValue("paymentMethod", paymentMethod, { shouldDirty: true })}
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
              <p className="font-bold text-brand-ink">Codigo de descuento</p>
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
                    <p className="font-bold">Cupon {appliedCoupon.couponCode} aplicado</p>
                    <p className="mt-1">Descuento: {appliedCoupon.discountPercentage}% ({formatArs(appliedCoupon.discountArs)})</p>
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
              <span>Descuento ({appliedCoupon.discountPercentage}%)</span>
              <span className="font-bold text-green-700">- {formatArs(appliedCoupon.discountArs)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span>Envio</span>
            <span className="font-bold text-brand-ink">{formatArs(pricing.shippingArs)}</span>
          </div>
          {pricing.paymentMethodDiscountArs > 0 ? (
            <div className="flex items-center justify-between">
              <span>Descuento transferencia ({pricing.paymentMethodDiscountPercentage}%)</span>
              <span className="font-bold text-green-700">- {formatArs(pricing.paymentMethodDiscountArs)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-brand-ink/10 pt-3">
            <span>Total</span>
            <span className="font-display text-2xl text-brand-pink md:text-3xl">{formatArs(pricing.totalArs)}</span>
          </div>
        </div>
        <div className="rounded-[1.5rem] bg-brand-peach p-4 text-sm text-brand-ink/70">
          <p>{settings.checkoutMessage || "Completas tus datos ahora y el pago se hace en el siguiente paso."}</p>
          <p className="mt-2">Envio gratis desde {formatArs(settings.freeShippingThreshold)}.</p>
        </div>
      </Card>
    </form>
  );
}
