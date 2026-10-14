"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { calculateDiscountedPrice, type ProductDiscountStatus } from "@/features/catalog/lib/product-discount";
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
          Cargá un porcentaje para cada producto. En la tienda se muestra el precio original tachado y al lado el precio
          con descuento, y es el precio que se cobra. Las fechas son opcionales: sin fechas, el descuento queda activo
          hasta que lo quites.
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
  const [percentage, setPercentage] = useState(product.discountPercentage ? String(product.discountPercentage) : "");
  const [startsOn, setStartsOn] = useState(product.startsOn);
  const [endsOn, setEndsOn] = useState(product.endsOn);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const parsedPercentage = Number(percentage);
  const previewPercentage =
    percentage.trim() !== "" && Number.isInteger(parsedPercentage) && parsedPercentage >= 1 && parsedPercentage <= 90
      ? parsedPercentage
      : null;
  const isDirty =
    percentage !== (product.discountPercentage ? String(product.discountPercentage) : "") ||
    startsOn !== product.startsOn ||
    endsOn !== product.endsOn;
  const status = statusLabel[product.status];

  async function submit(discountPercentage: number | null, nextStartsOn: string, nextEndsOn: string) {
    setError(null);
    setSaved(false);

    const response = await fetch(`/api/admin/product-discounts/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discountPercentage, startsOn: nextStartsOn, endsOn: nextEndsOn }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "No pudimos guardar el descuento.");
      return;
    }

    setSaved(true);
    router.refresh();
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

      <div className="grid gap-3 sm:grid-cols-[110px_1fr_1fr]">
        <label>
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
              setSaved(false);
            }}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-bold text-brand-ink/60">Desde (opcional)</span>
          <Input
            type="date"
            value={startsOn}
            onChange={(event) => {
              setStartsOn(event.target.value);
              setSaved(false);
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
              setSaved(false);
            }}
          />
        </label>
        <p className="text-sm text-brand-ink/70 sm:col-span-3">
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
        </p>
        {error ? <p className="text-sm font-bold text-red-600 sm:col-span-3">{error}</p> : null}
        {saved && !isDirty ? <p className="text-sm font-bold text-green-700 sm:col-span-3">Guardado.</p> : null}
      </div>

      <div className="flex flex-wrap gap-2 xl:flex-col xl:items-stretch">
        <Button
          type="button"
          size="sm"
          disabled={isPending || !isDirty}
          onClick={() => {
            if (percentage.trim() !== "" && !previewPercentage) {
              setError("El descuento tiene que ser un número entero entre 1 y 90.");
              return;
            }

            startTransition(async () => {
              await submit(previewPercentage, previewPercentage ? startsOn : "", previewPercentage ? endsOn : "");
            });
          }}
        >
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
        {product.discountPercentage ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                await submit(null, "", "");
                setPercentage("");
                setStartsOn("");
                setEndsOn("");
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
