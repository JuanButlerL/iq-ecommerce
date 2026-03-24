"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Product, ProductImage, ShippingRule, ShippingRuleProvince, StoreSettings } from "@prisma/client";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCartStore } from "@/features/cart/store";
import { calculateShippingQuote } from "@/features/cart/lib/shipping";
import { ARGENTINA_PROVINCES } from "@/lib/constants/provinces";
import { checkoutCustomerSchema, type CheckoutCustomerInput } from "@/lib/validations/checkout";
import { formatArs } from "@/lib/utils/currency";

type ProductWithImages = Product & { images: ProductImage[] };
type SettingsWithRule = StoreSettings & {
  activeShippingRule: (ShippingRule & { provinces: ShippingRuleProvince[] }) | null;
};

type CheckoutPageProps = {
  products: ProductWithImages[];
  settings: SettingsWithRule;
};

export function CheckoutPage({ products, settings }: CheckoutPageProps) {
  const router = useRouter();
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
    },
  });

  const province = form.watch("province");
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

          router.push(`/checkout/transfer/${payload.data.orderNumber}`);
        });
      })}
    >
      <Card className="order-2 space-y-5 p-5 md:p-6 lg:order-1">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Paso 1 de 2</p>
          <h1 className="font-display text-3xl text-brand-ink md:text-4xl">Completa tu compra</h1>
          <p className="mt-2 text-sm leading-6 text-brand-ink/70 md:text-base">
            Carga tus datos y generamos tu pedido. Despues te mostramos como pagar por transferencia.
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
        {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Generando pedido..." : "Generar pedido"}
        </Button>
      </Card>

      <Card className="order-1 h-fit space-y-4 p-5 md:p-6 lg:order-2 lg:sticky lg:top-28">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Resumen</p>
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
        <div className="space-y-3 border-t border-brand-ink/10 pt-4 text-sm text-brand-ink/70">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span className="font-bold text-brand-ink">{formatArs(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Envio</span>
            <span className="font-bold text-brand-ink">{formatArs(shippingQuote.shippingArs)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Total</span>
            <span className="font-display text-2xl text-brand-pink md:text-3xl">{formatArs(total)}</span>
          </div>
        </div>
        <div className="rounded-[1.5rem] bg-brand-peach p-4 text-sm text-brand-ink/70">
          <p>{settings.checkoutMessage || "Completas tus datos ahora y el pago se hace en el siguiente paso."}</p>
          {settings.orderReservationHours ? (
            <p className="mt-2">Reserva de pedido: {settings.orderReservationHours} horas.</p>
          ) : null}
          <p className="mt-2">Envio gratis desde {formatArs(settings.freeShippingThreshold)}.</p>
        </div>
      </Card>
    </form>
  );
}
