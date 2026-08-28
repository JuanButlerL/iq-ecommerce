"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Product, ProductImage, ShippingRule, ShippingRuleProvince, StoreSettings } from "@prisma/client";
import { AlertCircle } from "lucide-react";

import { TrackEventOnView } from "@/components/analytics/track-event-on-view";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { announceCartItemAdded } from "@/features/cart/cart-feedback-event";
import { useCartStore } from "@/features/cart/store";
import { trackEvent } from "@/lib/integrations/google-analytics/client";
import { trackAddToCart } from "@/lib/integrations/commerce-tracking";
import { formatArs } from "@/lib/utils/currency";
import { calculateShippingQuote } from "@/features/cart/lib/shipping";
import { ARGENTINA_PROVINCES } from "@/lib/constants/provinces";
import { WELCOME_POPUP_EMAIL_STORAGE_KEY } from "@/lib/marketing/welcome-popup-copy";

type ProductWithImages = Product & { images: ProductImage[] };
type SettingsWithRule = Omit<StoreSettings, "bankTransferDiscountPercentage"> & {
  bankTransferDiscountPercentage: number;
  activeShippingRule: (ShippingRule & { provinces: ShippingRuleProvince[] }) | null;
};

type CartPageProps = {
  products: ProductWithImages[];
  settings: SettingsWithRule;
  recoveryToken?: string;
};

const cartFallbackImageMap: Record<string, string> = {
  CACAO: "/home/cacao.webp",
  BANANA: "/home/banana.webp",
  PEANUT: "/home/mani.webp",
};

export function CartPage({ products, settings, recoveryToken }: CartPageProps) {
  const router = useRouter();
  const emailInputRef = useRef<HTMLInputElement>(null);
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const updateItem = useCartStore((state) => state.updateItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const replaceItems = useCartStore((state) => state.replaceItems);
  const [province, setProvince] = useState("Buenos Aires");
  const [email, setEmail] = useState("");
  const [capturedEmail, setCapturedEmail] = useState("");
  const [captureError, setCaptureError] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isRecoveringCart, setIsRecoveringCart] = useState(Boolean(recoveryToken));

  const detailedItems = useMemo(
    () =>
      items
        .map((item) => ({
          cart: item,
          product: products.find((product) => product.id === item.productId),
        }))
        .filter((entry): entry is { cart: typeof items[number]; product: ProductWithImages } => Boolean(entry.product)),
    [items, products],
  );
  const suggestedProducts = useMemo(() => {
    const selectedProductIds = new Set(items.map((item) => item.productId));

    return products.filter(
      (product) =>
        product.active &&
        product.visible &&
        !product.manualSoldOut &&
        !selectedProductIds.has(product.id),
    );
  }, [items, products]);

  useEffect(() => {
    if (!recoveryToken) {
      return;
    }

    let isMounted = true;
    const token = recoveryToken;

    async function recoverCart() {
      try {
        const response = await fetch(`/api/cart-recovery/${encodeURIComponent(token)}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "No se pudo recuperar el carrito.");
        }

        if (!isMounted) {
          return;
        }

        replaceItems(payload.data.items);
        setEmail(payload.data.email);
        setCapturedEmail(payload.data.email);
        window.localStorage.setItem(WELCOME_POPUP_EMAIL_STORAGE_KEY, payload.data.email);

        if (payload.data.province) {
          setProvince(payload.data.province);
        }

        setCaptureError("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCaptureError(error instanceof Error ? error.message : "No se pudo recuperar el carrito.");
      } finally {
        if (isMounted) {
          setIsRecoveringCart(false);
        }
      }
    }

    recoverCart();

    return () => {
      isMounted = false;
    };
  }, [recoveryToken, replaceItems]);

  useEffect(() => {
    if (recoveryToken || capturedEmail) {
      return;
    }

    const storedEmail = window.localStorage.getItem(WELCOME_POPUP_EMAIL_STORAGE_KEY)?.trim().toLowerCase() ?? "";

    if (!storedEmail) {
      return;
    }

    setEmail((current) => current || storedEmail);
    setCapturedEmail(storedEmail);
  }, [capturedEmail, recoveryToken]);

  const subtotal = detailedItems.reduce((acc, item) => acc + item.product.priceArs * item.cart.quantity, 0);
  const shippingQuote = calculateShippingQuote(subtotal, province, settings);
  const total = subtotal + shippingQuote.shippingArs;
  const checkoutParams = new URLSearchParams({ province });
  const checkoutEmail = capturedEmail || email.trim();

  if (checkoutEmail) {
    checkoutParams.set("email", checkoutEmail);
  }

  const checkoutHref = `/checkout?${checkoutParams.toString()}`;
  const amountToShippingDiscount = shippingQuote.shippingDiscountThresholdArs
    ? Math.max(0, shippingQuote.shippingDiscountThresholdArs - subtotal)
    : 0;
  const amountToFreeShipping = Math.max(0, settings.freeShippingThreshold - subtotal);
  const oneMoreUnitReachesFreeShipping =
    amountToFreeShipping > 0 &&
    products.some((product) => {
      const label = `${product.homeVarietyLabel ?? ""} ${product.name}`.toLocaleLowerCase("es");
      return !product.manualSoldOut && !label.includes("mix") && product.priceArs >= amountToFreeShipping;
    });
  const freeShippingNudge =
    amountToFreeShipping <= 0
      ? "Ya tenés envío gratis."
      : oneMoreUnitReachesFreeShipping
        ? "Sumá una unidad más para llegar al envío gratis y tener la semana resuelta."
        : `El pedido todavía no alcanza el envío gratis. Envío gratis desde: ${formatArs(settings.freeShippingThreshold)}.`;

  const shippingNudge = shippingQuote.freeShippingReached
    ? "Ya tenés envío gratis."
    : shippingQuote.shippingDiscountReached
      ? `Tenés ${shippingQuote.shippingDiscountPercentage}% off en el envío. Si llegás a ${formatArs(settings.freeShippingThreshold)}, el envío es gratis.`
      : amountToShippingDiscount > 0 && shippingQuote.shippingDiscountPercentage > 0
        ? `Sumá un producto más y activá ${shippingQuote.shippingDiscountPercentage}% off en el envío.`
        : freeShippingNudge;

  async function captureCartRecovery(emailToCapture: string, options: { silent?: boolean } = {}) {
    const trimmedEmail = emailToCapture.trim().toLowerCase();

    if (!trimmedEmail || detailedItems.length === 0) {
      return false;
    }

    if (!options.silent) {
      setIsCapturing(true);
      setCaptureError("");
    }

    try {
      const response = await fetch("/api/cart-recovery", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          province,
          items: detailedItems.map(({ cart }) => ({
            productId: cart.productId,
            quantity: cart.quantity,
          })),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "No pudimos guardar tu carrito.");
      }

      setCapturedEmail(payload.data.email);
      window.localStorage.setItem(WELCOME_POPUP_EMAIL_STORAGE_KEY, payload.data.email);
      return true;
    } catch (error) {
      if (!options.silent) {
        setCaptureError(error instanceof Error ? error.message : "No pudimos validar el email.");
      }

      return false;
    } finally {
      if (!options.silent) {
        setIsCapturing(false);
      }
    }
  }

  async function handleContinueCheckout() {
    const trimmedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setCaptureError("Ingresá un email válido para continuar con la compra.");
      emailInputRef.current?.focus();
      return;
    }

    const wasCaptured = await captureCartRecovery(trimmedEmail);

    if (!wasCaptured) {
      return;
    }

    router.push(checkoutHref);
  }

  useEffect(() => {
    if (!capturedEmail || detailedItems.length === 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      captureCartRecovery(capturedEmail, { silent: true });
    }, 900);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturedEmail, province, items]);

  if (isRecoveringCart) {
    return (
      <EmptyState
        title="Estamos recuperando tu carrito"
        description="En unos segundos vas a ver los productos que habías seleccionado."
        actionHref="/#productos"
        actionLabel="Ver productos"
      />
    );
  }

  if (detailedItems.length === 0) {
    return (
      <EmptyState
        title="Tu carrito está vacío"
        description="Elegí una de nuestras barritas y avanzá con un checkout rápido por transferencia."
        actionHref="/#productos"
        actionLabel="Ver productos"
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
      <TrackEventOnView
        eventName="view_cart"
        params={{
          currency: "ARS",
          value: subtotal,
          items: detailedItems.map(({ cart, product }) => ({
            item_id: product.id,
            item_name: product.name,
            item_category: "Productos",
            price: product.priceArs,
            quantity: cart.quantity,
          })),
        }}
      />
      <div className="space-y-4">
        {detailedItems.map(({ cart, product }) => (
          <Card key={product.id} className="p-4 md:p-5">
            <div className="grid grid-cols-[56px_minmax(0,1fr)_88px] items-start gap-x-4 gap-y-2 md:grid-cols-[80px_minmax(0,1fr)_120px] md:items-center md:gap-5">
              <div className="relative mt-1 h-14 w-14 shrink-0 overflow-hidden bg-white md:h-20 md:w-20 md:rounded-[1.25rem]">
                <img
                  src={product.images[0]?.publicUrl ?? cartFallbackImageMap[product.colorTheme]}
                  alt={product.images[0]?.altText ?? product.name}
                  className="h-full w-full object-contain p-0.5 md:p-2"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = cartFallbackImageMap[product.colorTheme];
                  }}
                />
              </div>

              <div className="min-w-0">
                <h2 className="text-[0.95rem] font-medium leading-[1.16] text-brand-ink md:text-lg md:font-extrabold md:leading-6">
                  {product.name}
                </h2>
                <p className="mt-1 text-xs font-extrabold leading-5 text-emerald-700 md:text-sm">✓ Seleccionado por nutricionistas · Sin sellos</p>
                <p className="mt-2 text-[0.95rem] leading-none text-brand-ink md:mt-1 md:text-sm md:text-brand-ink/60">
                  {formatArs(product.priceArs * cart.quantity)}
                </p>
              </div>

              <div className="flex flex-col items-end gap-3 md:justify-self-end">
                <button
                  type="button"
                  className="text-[0.95rem] font-normal leading-none text-brand-ink/70 underline underline-offset-2 hover:text-brand-pink"
                  onClick={() => {
                    trackEvent("remove_from_cart", {
                      currency: "ARS",
                      value: product.priceArs * cart.quantity,
                      items: [
                        {
                          item_id: product.id,
                          item_name: product.name,
                          item_category: "Productos",
                          price: product.priceArs,
                          quantity: cart.quantity,
                        },
                      ],
                    });
                    removeItem(product.id);
                  }}
                >
                  Borrar
                </button>

                <div className="inline-flex items-center border border-brand-ink/15 bg-white">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center text-xl font-light text-brand-ink/70"
                    onClick={() => updateItem(product.id, Math.max(cart.quantity - 1, 1))}
                  >
                    -
                  </button>
                  <span className="flex h-9 min-w-10 items-center justify-center text-base font-medium text-brand-ink">
                    {cart.quantity}
                  </span>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center text-xl font-light text-brand-ink/70"
                    onClick={() => {
                      if (cart.quantity >= 99) return;
                      updateItem(product.id, cart.quantity + 1);
                      trackAddToCart({
                        productId: product.id,
                        productName: product.name,
                        priceArs: product.priceArs,
                        quantity: 1,
                      });
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {suggestedProducts.length > 0 ? (
          <div className="rounded-[1.65rem] border border-brand-ink/8 bg-white p-4 shadow-[0_10px_26px_rgba(44,34,65,0.04)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-extrabold leading-5 text-brand-ink">Sumar otro sabor</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {suggestedProducts.map((product) => {
                const productLabel = product.homeVarietyLabel?.trim() || product.name;
                const image = product.images[0];
                const fallbackImage = cartFallbackImageMap[product.colorTheme];

                return (
                  <div
                    key={product.id}
                    className="grid grid-cols-[58px_minmax(0,1fr)_92px] items-center gap-3 rounded-[1.25rem] border border-brand-ink/8 bg-brand-cream/35 p-3 transition hover:border-brand-pink/30 hover:bg-white hover:shadow-[0_12px_30px_rgba(44,34,65,0.06)]"
                  >
                    <div className="h-14 w-14 overflow-hidden rounded-[1rem] bg-white shadow-[0_8px_18px_rgba(44,34,65,0.06)]">
                      <img
                        src={image?.publicUrl ?? fallbackImage}
                        alt={image?.altText ?? product.name}
                        className="h-full w-full object-contain p-1.5"
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = fallbackImage;
                        }}
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-[0.92rem] font-extrabold leading-5 text-brand-ink">{productLabel}</p>
                      <p className="mt-1 text-sm font-bold text-brand-ink/55">{formatArs(product.priceArs)}</p>
                    </div>

                    <div className="inline-flex items-center justify-self-end rounded-full border border-brand-ink/12 bg-white shadow-[0_8px_18px_rgba(44,34,65,0.05)]">
                      <button
                        type="button"
                        className="flex h-9 w-8 cursor-not-allowed items-center justify-center text-lg font-light text-brand-ink/25"
                        disabled
                        aria-label={`${productLabel} todavia no esta en el carrito`}
                      >
                        -
                      </button>
                      <span className="flex h-9 min-w-7 items-center justify-center text-sm font-extrabold text-brand-ink/55">
                        0
                      </span>
                      <button
                        type="button"
                        className="flex h-9 w-8 items-center justify-center text-lg font-light text-brand-pink transition hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/30"
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
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
            <Link
              href="/#productos"
              className="inline-flex w-full items-center justify-center rounded-full border border-brand-pink/28 bg-white px-4 py-2.5 text-sm font-extrabold text-brand-pink transition hover:border-brand-pink hover:bg-brand-pink/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/30"
            >Ver más productos</Link>
        )}
      </div>

      <Card className="h-fit space-y-5 p-5 md:p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Resumen</p>
          <div className="mt-4 space-y-3 text-sm text-brand-ink/70">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-bold text-brand-ink">{formatArs(subtotal)}</span>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-brand-ink">Seleccionar provincia para el envío</label>
              <Select value={province} onChange={(event) => setProvince(event.target.value)}>
                {ARGENTINA_PROVINCES.map((item) => (
                  <option key={item.code} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span>Envío estimado</span>
              {shippingQuote.freeShippingReached ? (
                <span className="font-bold text-emerald-700">Gratis</span>
              ) : shippingQuote.shippingDiscountReached ? (
                <span className="flex items-center gap-2 font-bold">
                  <span className="text-brand-ink/35 line-through">{formatArs(shippingQuote.baseShippingArs)}</span>
                  <span className="text-emerald-700">{formatArs(shippingQuote.shippingArs)}</span>
                </span>
              ) : (
                <span className="font-bold text-brand-ink">{formatArs(shippingQuote.shippingArs)}</span>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-brand-ink/10 pt-3">
              <span>Total estimado</span>
              <span className="text-2xl font-extrabold text-brand-pink md:text-3xl">{formatArs(total)}</span>
            </div>
          </div>
        </div>
        <p className="text-sm italic leading-6 text-brand-ink/60">
          Revisamos cada ingrediente para que vos no tengas que hacerlo. Eso es lo que llega a tu casa.
        </p>
        <div className="border-t border-brand-ink/10 pt-4">
          <label htmlFor="cart-recovery-email" className="mb-2 block text-sm font-bold text-brand-ink">
            Email
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="cart-recovery-email"
              ref={emailInputRef}
              type="email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setCaptureError("");
              }}
              placeholder="nombre@correo.com"
              aria-invalid={captureError ? "true" : "false"}
              className={`min-h-11 flex-1 rounded-full bg-white px-4 text-sm font-bold text-brand-ink outline-none transition placeholder:text-brand-ink/30 ${
                captureError
                  ? "border border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-100"
                  : "border border-brand-ink/12 focus:border-brand-pink/50 focus:ring-4 focus:ring-brand-pink/10"
              }`}
            />
          </div>
          {captureError ? (
            <div className="mt-3 flex items-start gap-2 rounded-[1.15rem] border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{captureError}</p>
            </div>
          ) : null}
        </div>
        <p className="text-sm font-bold leading-6 text-emerald-700">{shippingNudge}</p>
        <div className="pt-2">
          <Button type="button" className="w-full" disabled={isCapturing} onClick={handleContinueCheckout}>
            {isCapturing ? "Continuando..." : "Continuar compra"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

