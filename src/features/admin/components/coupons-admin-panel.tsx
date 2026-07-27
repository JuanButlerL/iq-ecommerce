"use client";

import type { CouponUsageType } from "@prisma/client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatArs } from "@/lib/utils/currency";

type CouponsAdminPanelProps = {
  coupons: CouponListItem[];
};

type CouponListItem = {
  id: string;
  code: string;
  description: string | null;
  discountPercentage: number;
  usageType: CouponUsageType;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { orders: number };
};

type CouponFormState = {
  code: string;
  bulkCodes: string;
  description: string;
  discountPercentage: string;
  usageType: CouponUsageType;
  active: boolean;
};

const emptyForm: CouponFormState = {
  code: "",
  bulkCodes: "",
  description: "",
  discountPercentage: "10",
  usageType: "UNLIMITED",
  active: true,
};

const usageLabels: Record<CouponUsageType, string> = {
  UNLIMITED: "Ilimitado",
  SINGLE_USE: "Un uso total",
  SINGLE_USE_PER_CUSTOMER: "Un uso por DNI",
};

const usageHelp: Record<CouponUsageType, string> = {
  UNLIMITED: "No se desactiva por uso. Ideal para campañas abiertas.",
  SINGLE_USE: "Sirve para una sola compra confirmada. Después queda bloqueado automáticamente.",
  SINGLE_USE_PER_CUSTOMER: "Cada DNI puede usarlo una vez en una compra confirmada.",
};

export function CouponsAdminPanel({ coupons }: CouponsAdminPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponFormState>(emptyForm);

  const editingCoupon = useMemo(
    () => coupons.find((coupon) => coupon.id === editingCouponId) ?? null,
    [coupons, editingCouponId],
  );
  const bulkCodes = parseBulkCodes(form.bulkCodes);
  const isBulkMode = !editingCouponId && bulkCodes.length > 0;

  function resetForm() {
    setEditingCouponId(null);
    setForm(emptyForm);
    setError(null);
    setMessage(null);
  }

  function loadCoupon(coupon: CouponListItem) {
    setEditingCouponId(coupon.id);
    setForm({
      code: coupon.code,
      bulkCodes: "",
      description: coupon.description ?? "",
      discountPercentage: Number(coupon.discountPercentage).toString(),
      usageType: coupon.usageType,
      active: coupon.active,
    });
    setError(null);
    setMessage(null);
  }

  async function submitForm() {
    const codes = isBulkMode ? bulkCodes : [form.code].filter(Boolean);
    const url = editingCouponId ? `/api/admin/coupons/${editingCouponId}` : "/api/admin/coupons";
    const method = editingCouponId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: codes[0] ?? form.code,
        codes,
        description: form.description,
        discountPercentage: form.discountPercentage,
        usageType: form.usageType,
        active: form.active,
      }),
    });

    const payload = (await response.json()) as { error?: string; data?: { created?: number; updated?: number } };

    if (!response.ok) {
      setError(payload.error ?? "No pudimos guardar el cupón.");
      return;
    }

    setMessage(
      editingCouponId
        ? "Cupón actualizado."
        : `${payload.data?.created ?? codes.length} cupón${(payload.data?.created ?? codes.length) === 1 ? "" : "es"} creado${(payload.data?.created ?? codes.length) === 1 ? "" : "s"}.`,
    );
    setEditingCouponId(null);
    setForm(emptyForm);
    router.refresh();
  }

  async function removeCoupon(couponId: string) {
    const response = await fetch(`/api/admin/coupons/${couponId}`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "No pudimos eliminar el cupón.");
      return;
    }

    if (editingCouponId === couponId) {
      resetForm();
    }

    setMessage("Cupón eliminado.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Cupones</p>
        <h1 className="font-display text-3xl text-brand-ink md:text-5xl">Descuentos del checkout</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/70 md:text-base">
          Creá códigos ilimitados, de un uso total o de un uso por DNI. El descuento impacta solo en productos, no en el envío.
        </p>
      </div>

      {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="space-y-5 p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">
                {editingCoupon ? "Editar cupón" : "Nuevo cupón"}
              </p>
              <p className="mt-2 text-sm text-brand-ink/70">
                Para carga masiva, pegá varios códigos en el bloque de abajo.
              </p>
            </div>
            {editingCoupon ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4">
            <Field label="Código">
              <Input
                value={form.code}
                maxLength={40}
                placeholder="MICA10"
                disabled={isBulkMode}
                onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
              />
            </Field>

            {!editingCoupon ? (
              <Field label="Códigos masivos">
                <Textarea
                  rows={5}
                  value={form.bulkCodes}
                  placeholder={"MICA10\nMICA11\nMICA12"}
                  onChange={(event) => setForm((current) => ({ ...current, bulkCodes: event.target.value.toUpperCase() }))}
                />
                <p className="mt-2 text-xs font-bold text-brand-ink/45">
                  Separalos por coma, espacio o salto de línea. Detectados: {bulkCodes.length || 0}.
                </p>
              </Field>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
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
              <Field label="Tipo de uso">
                <select
                  value={form.usageType}
                  onChange={(event) => setForm((current) => ({ ...current, usageType: event.target.value as CouponUsageType }))}
                  className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
                >
                  {Object.entries(usageLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <p className="rounded-2xl bg-background px-4 py-3 text-xs font-bold leading-5 text-brand-ink/60">
              {usageHelp[form.usageType]}
            </p>

            <Field label="Descripción interna">
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

          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={isPending}
            onClick={() => {
              setError(null);
              setMessage(null);
              startTransition(async () => {
                await submitForm();
              });
            }}
          >
            {isPending ? "Guardando..." : editingCoupon ? "Guardar cambios" : isBulkMode ? `Crear ${bulkCodes.length} cupones` : "Crear cupón"}
          </Button>
        </Card>

        <Card className="space-y-4 p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Listado actual</p>
              <p className="mt-2 text-sm text-brand-ink/70">{coupons.length} cupones cargados.</p>
            </div>
            <div className="rounded-full bg-brand-peach px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-pink">
              Excluye envío
            </div>
          </div>

          <div className="space-y-3">
            {coupons.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-brand-ink/15 p-6 text-sm text-brand-ink/55">
                Todavía no hay cupones creados.
              </div>
            ) : (
              coupons.map((coupon) => {
                const isEditing = coupon.id === editingCouponId;
                const sampleSubtotal = 15000;
                const sampleDiscount = Math.round((sampleSubtotal * Number(coupon.discountPercentage)) / 100);
                const usedCount = coupon._count?.orders ?? 0;

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
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-ink/55">
                            {usageLabels[coupon.usageType]}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-brand-ink/70">{coupon.description || "Sin descripción interna."}</p>
                        <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
                          <span className="text-brand-pink">{Number(coupon.discountPercentage)}% OFF</span>
                          <span className="text-brand-ink/55">{usedCount} usos confirmados</span>
                        </div>
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
                            setMessage(null);
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

function parseBulkCodes(value: string) {
  return Array.from(new Set(value.split(/[\s,;]+/).map((entry) => entry.trim().toUpperCase()).filter(Boolean)));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-brand-ink/75">{label}</span>
      {children}
    </label>
  );
}
