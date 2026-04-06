"use client";

import type { Coupon } from "@prisma/client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatArs } from "@/lib/utils/currency";

type CouponsAdminPanelProps = {
  coupons: Coupon[];
};

type CouponFormState = {
  code: string;
  description: string;
  discountPercentage: string;
  active: boolean;
};

const emptyForm: CouponFormState = {
  code: "",
  description: "",
  discountPercentage: "10",
  active: true,
};

export function CouponsAdminPanel({ coupons }: CouponsAdminPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponFormState>(emptyForm);

  const editingCoupon = useMemo(
    () => coupons.find((coupon) => coupon.id === editingCouponId) ?? null,
    [coupons, editingCouponId],
  );

  function resetForm() {
    setEditingCouponId(null);
    setForm(emptyForm);
    setError(null);
  }

  function loadCoupon(coupon: Coupon) {
    setEditingCouponId(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description ?? "",
      discountPercentage: Number(coupon.discountPercentage).toString(),
      active: coupon.active,
    });
    setError(null);
  }

  async function submitForm() {
    const url = editingCouponId ? `/api/admin/coupons/${editingCouponId}` : "/api/admin/coupons";
    const method = editingCouponId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        description: form.description,
        discountPercentage: form.discountPercentage,
        active: form.active,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "No pudimos guardar el cupón.");
      return;
    }

    resetForm();
    router.refresh();
  }

  async function removeCoupon(couponId: string) {
    const response = await fetch(`/api/admin/coupons/${couponId}`, {
      method: "DELETE",
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "No pudimos eliminar el cupón.");
      return;
    }

    if (editingCouponId === couponId) {
      resetForm();
    }

    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Cupones</p>
        <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Descuentos del checkout</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/70 md:text-base">
          Ventas puede crear codigos para influencers y promociones puntuales. El descuento impacta solo en el subtotal del pedido, nunca en el envio.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="space-y-5 p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">
                {editingCoupon ? "Editar cupón" : "Nuevo cupón"}
              </p>
              <p className="mt-2 text-sm text-brand-ink/70">
                Usa codigos simples como `MICA10` o `LANZAMIENTO5`.
              </p>
            </div>
            {editingCoupon ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4">
            <Field label="Codigo">
              <Input
                value={form.code}
                maxLength={40}
                placeholder="MICA10"
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
              />
            </Field>
            <Field label="Descuento (%)">
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={form.discountPercentage}
                onChange={(event) => setForm((current) => ({ ...current, discountPercentage: event.target.value }))}
              />
            </Field>
            <Field label="Descripcion interna">
              <Input
                value={form.description}
                maxLength={160}
                placeholder="Influencer abril 2026"
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </Field>
            <Checkbox
              label="Cupón activo"
              checked={form.active}
              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
            />
          </div>

          {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}

          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                await submitForm();
              });
            }}
          >
            {isPending ? "Guardando..." : editingCoupon ? "Guardar cambios" : "Crear cupón"}
          </Button>
        </Card>

        <Card className="space-y-4 p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Listado actual</p>
              <p className="mt-2 text-sm text-brand-ink/70">{coupons.length} cupones cargados.</p>
            </div>
            <div className="rounded-full bg-brand-peach px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-pink">
              El descuento excluye envio
            </div>
          </div>

          <div className="space-y-3">
            {coupons.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-brand-ink/15 p-6 text-sm text-brand-ink/55">
                Todavia no hay cupones creados.
              </div>
            ) : (
              coupons.map((coupon) => {
                const isEditing = coupon.id === editingCouponId;
                const sampleSubtotal = 15000;
                const sampleDiscount = Math.round((sampleSubtotal * Number(coupon.discountPercentage)) / 100);

                return (
                  <div
                    key={coupon.id}
                    className={`rounded-[1.5rem] border p-4 transition ${
                      isEditing ? "border-brand-pink bg-brand-pink/5" : "border-brand-ink/10 bg-background"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold uppercase tracking-[0.14em] text-brand-ink">{coupon.code}</p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${
                              coupon.active ? "bg-green-100 text-green-700" : "bg-brand-ink/10 text-brand-ink/55"
                            }`}
                          >
                            {coupon.active ? "Activo" : "Pausado"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-brand-ink/70">
                          {coupon.description || "Sin descripcion interna."}
                        </p>
                        <p className="mt-3 text-sm font-bold text-brand-pink">
                          {Number(coupon.discountPercentage)}% OFF
                        </p>
                        <p className="mt-1 text-xs text-brand-ink/55">
                          Ejemplo: {formatArs(sampleSubtotal)} subtotal {"->"} {formatArs(sampleDiscount)} descuento
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => loadCoupon(coupon)}>
                          {isEditing ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => {
                            setError(null);
                            startTransition(async () => {
                              await removeCoupon(coupon.id);
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-brand-ink/75">{label}</span>
      {children}
    </label>
  );
}
