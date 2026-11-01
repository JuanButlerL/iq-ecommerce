"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  BUY_X_PAY_Y_MAX_BUY_QUANTITY,
  calculateDiscountedPrice,
  isValidBuyXPayY,
  type ProductDiscountKind,
  type ProductDiscountStatus,
} from "@/features/catalog/lib/product-discount";
import type { AdminProductDiscount } from "@/features/product-discounts/queries";
import { formatArs } from "@/lib/utils/currency";

type ProductDiscountsAdminPanelProps = {
  products: AdminProductDiscount[];
};

const statusLabel: Record<ProductDiscountStatus, { label: string; className: string }> = {
  none: { label: "Sin descuento", className: "bg-brand-ink/10 text-brand-ink/55" },
  active: { label: "Activo", className: "bg-green-100 text-green-700" },
  scheduled: { label: "Programado", className: "bg-amber-100 text-amber-700" },
  expired: { label: "Vencido", className: "bg-red-100 text-red-700" },
};

export function ProductDiscountsAdminPanel({ products }: ProductDiscountsAdminPanelProps) {
  const activeCount = products.filter((product) => product.status === "active").length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Descuentos</p>
        <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Descuentos por producto</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-ink/70 md:text-base">
          Cargá un porcentaje o una promo NxM (2x1, 3x2, la combinación que quieras) para cada producto. Con porcentaje se
          muestra el precio original tachado y al lado el precio con descuento. Con NxM la tienda muestra la etiqueta (ej:
          3x2) y en el carrito cada N unidades de ese producto se cobran M. Las fechas son opcionales: sin fechas, el
          descuento queda activo hasta que lo quites.
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-ink/70 md:text-base">
          No se acumula con cupones: si el carrito tiene productos con descuento (porcentaje o NxM), el cupón se aplica
          solo sobre los demás. El descuento por transferencia sí se suma. El NxM por producto cuenta unidades del mismo
          producto; para combinar sabores distintos usá un cupón NxM.
        </p>
        <p className="mt-3 text-sm font-bold text-brand-ink/60">
          {activeCount} {activeCount === 1 ? "producto con descuento activo" : "productos con descuento activo"}.
        </p>
      </div>

      <Card className="divide-y divide-brand-ink/8 p-0">
        {products.length === 0 ? (
          <p className="p-6 text-sm text-brand-ink/55">Todavía no hay productos cargados.</p>
        ) : (
          products.map((product) => <ProductDiscountRow key={product.id} product={product} />)
        )}
      </Card>
    </div>
  );
}

function ProductDiscountRow({ product }: { product: AdminProductDiscount }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initialType: ProductDiscountKind = product.discountType === "BUY_X_PAY_Y" ? "BUY_X_PAY_Y" : "PERCENTAGE";
  const initialPercentage = product.discountPercentage ? String(product.discountPercentage) : "";
  const initialBuy = product.buyQuantity ? String(product.buyQuantity) : "";
  const initialPay = product.payQuantity ? String(product.payQuantity) : "";
  const [discountType, setDiscountType] = useState<ProductDiscountKind>(initialType);
  const [percentage, setPercentage] = useState(initialPercentage);
  const [buyQuantity, setBuyQuantity] = useState(initialBuy);
  const [payQuantity, setPayQuantity] = useState(initialPay);
  const [freeUnitsCount, setFreeUnitsCount] = useState(product.freeUnitsCountForFreeShipping);
  const [startsOn, setStartsOn] = useState(product.startsOn);
  const [endsOn, setEndsOn] = useState(product.endsOn);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const hasSavedDiscount = Boolean(product.discountPercentage || (product.buyQuantity && product.payQuantity));
  const parsedPercentage = Number(percentage);
  const previewPercentage =
    percentage.trim() !== "" && Number.isInteger(parsedPercentage) && parsedPercentage >= 1 && parsedPercentage <= 90
      ? parsedPercentage
      : null;
  const parsedBuy = Number(buyQuantity);
  const parsedPay = Number(payQuantity);
  const buyXPayYFilled = buyQuantity.trim() !== "" || payQuantity.trim() !== "";
  const previewBuyXPayY = buyXPayYFilled && isValidBuyXPayY(parsedBuy, parsedPay) ? { buy: parsedBuy, pay: parsedPay } : null;
  const isBuyXPayY = discountType === "BUY_X_PAY_Y";
  const hasPreview = isBuyXPayY ? Boolean(previewBuyXPayY) : Boolean(previewPercentage);
  const isDirty =
    discountType !== initialType ||
    percentage !== initialPercentage ||
    buyQuantity !== initialBuy ||
    payQuantity !== initialPay ||
    freeUnitsCount !== product.freeUnitsCountForFreeShipping ||
    startsOn !== product.startsOn ||
    endsOn !== product.endsOn;
  const status = statusLabel[product.status];

  function markChanged() {
    setSaved(false);
  }

  async function submit(body: Record<string, unknown>) {
    setError(null);
    setSaved(false);

    const response = await fetch(`/api/admin/product-discounts/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "No pudimos guardar el descuento.");
      return false;
    }

    setSaved(true);
    router.refresh();
    return true;
  }

  function save() {
    if (isBuyXPayY && buyXPayYFilled && !previewBuyXPayY) {
      setError(
        `El NxM no es válido: llevás entre 2 y ${BUY_X_PAY_Y_MAX_BUY_QUANTITY} unidades y pagás menos de las que llevás (ej: 3x2).`,
      );
      return;
    }

    if (!isBuyXPayY && percentage.trim() !== "" && !previewPercentage) {
      setError("El descuento tiene que ser un número entero entre 1 y 90.");
      return;
    }

    startTransition(async () => {
      await submit({
        discountType,
        discountPercentage: isBuyXPayY ? null : previewPercentage,
        buyQuantity: isBuyXPayY && previewBuyXPayY ? previewBuyXPayY.buy : null,
        payQuantity: isBuyXPayY && previewBuyXPayY ? previewBuyXPayY.pay : null,
        freeUnitsCountForFreeShipping: freeUnitsCount,
        startsOn: hasPreview ? startsOn : "",
        endsOn: hasPreview ? endsOn : "",
      });
    });
  }

  return (
    <div className="grid gap-4 p-5 md:p-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_auto] xl:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-background ring-1 ring-brand-ink/10">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="h-full w-full object-contain p-1" />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-brand-ink">{product.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${status.className}`}>
              {status.label}
            </span>
            {!product.active || !product.visible ? (
              <span className="rounded-full bg-brand-ink/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-ink/55">
                No visible en la tienda
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[150px_1fr_1fr]">
        <label>
          <span className="mb-1 block text-xs font-bold text-brand-ink/60">Tipo</span>
          <Select
            value={discountType}
            onChange={(event) => {
              setDiscountType(event.target.value as ProductDiscountKind);
              setError(null);
              markChanged();
            }}
          >
            <option value="PERCENTAGE">Porcentaje</option>
            <option value="BUY_X_PAY_Y">NxM (2x1, 3x2...)</option>
          </Select>
        </label>
        {isBuyXPayY ? (
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <label>
              <span className="mb-1 block text-xs font-bold text-brand-ink/60">Llevás (N)</span>
              <Input
                type="number"
                inputMode="numeric"
                min={2}
                max={BUY_X_PAY_Y_MAX_BUY_QUANTITY}
                value={buyQuantity}
                placeholder="3"
                onChange={(event) => {
                  setBuyQuantity(event.target.value);
                  markChanged();
                }}
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-bold text-brand-ink/60">Pagás (M)</span>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={BUY_X_PAY_Y_MAX_BUY_QUANTITY - 1}
                value={payQuantity}
                placeholder="2"
                onChange={(event) => {
                  setPayQuantity(event.target.value);
                  markChanged();
                }}
              />
            </label>
          </div>
        ) : (
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs font-bold text-brand-ink/60">Descuento %</span>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={90}
              value={percentage}
              placeholder="0"
              onChange={(event) => {
                setPercentage(event.target.value);
                markChanged();
              }}
            />
          </label>
        )}
        <div className="hidden sm:block" />
        <label>
          <span className="mb-1 block text-xs font-bold text-brand-ink/60">Desde (opcional)</span>
          <Input
            type="date"
            value={startsOn}
            onChange={(event) => {
              setStartsOn(event.target.value);
              markChanged();
            }}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold text-brand-ink/60">Hasta (opcional)</span>
          <Input
            type="date"
            value={endsOn}
            min={startsOn || undefined}
            onChange={(event) => {
              setEndsOn(event.target.value);
              markChanged();
            }}
          />
        </label>
        {isBuyXPayY ? (
          <div className="sm:col-span-3">
            <Checkbox
              label="Las unidades sin cargo suman para el envío gratis"
              checked={freeUnitsCount}
              onChange={(event) => {
                setFreeUnitsCount(event.target.checked);
                markChanged();
              }}
            />
          </div>
        ) : null}
        <p className="text-sm text-brand-ink/70 sm:col-span-3">
          {isBuyXPayY ? (
            previewBuyXPayY ? (
              <>
                <span className="font-extrabold text-brand-pink">
                  {previewBuyXPayY.buy}x{previewBuyXPayY.pay}
                </span>
                : llevando {previewBuyXPayY.buy} se cobran {previewBuyXPayY.pay} ({formatArs(product.priceArs * previewBuyXPayY.pay)}{" "}
                en vez de {formatArs(product.priceArs * previewBuyXPayY.buy)}).{" "}
                {freeUnitsCount
                  ? "Las unidades gratis suman para el envío gratis."
                  : "Las unidades gratis no suman para el envío gratis."}
              </>
            ) : (
              <>
                Precio: <span className="font-bold text-brand-ink">{formatArs(product.priceArs)}</span>
              </>
            )
          ) : (
            <>
              Precio:{" "}
              {previewPercentage ? (
                <>
                  <s className="text-brand-ink/40">{formatArs(product.priceArs)}</s>{" "}
                  <span className="font-extrabold text-brand-pink">
                    {formatArs(calculateDiscountedPrice(product.priceArs, previewPercentage))}
                  </span>
                </>
              ) : (
                <span className="font-bold text-brand-ink">{formatArs(product.priceArs)}</span>
              )}
            </>
          )}
        </p>
        {error ? <p className="text-sm font-bold text-red-600 sm:col-span-3">{error}</p> : null}
        {saved && !isDirty ? <p className="text-sm font-bold text-green-700 sm:col-span-3">Guardado.</p> : null}
      </div>

      <div className="flex flex-wrap gap-2 xl:flex-col xl:items-stretch">
        <Button type="button" size="sm" disabled={isPending || !isDirty} onClick={save}>
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
        {hasSavedDiscount ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const removed = await submit({
                  discountType: "PERCENTAGE",
                  discountPercentage: null,
                  buyQuantity: null,
                  payQuantity: null,
                  startsOn: "",
                  endsOn: "",
                });

                if (removed) {
                  setDiscountType("PERCENTAGE");
                  setPercentage("");
                  setBuyQuantity("");
                  setPayQuantity("");
                  setFreeUnitsCount(true);
                  setStartsOn("");
                  setEndsOn("");
                }
              });
            }}
          >
            Quitar descuento
          </Button>
        ) : null}
      </div>
    </div>
  );
}
