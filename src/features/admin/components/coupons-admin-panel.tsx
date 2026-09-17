"use client";

import type { CouponDiscountType, CouponUsageType } from "@prisma/client";
import { ChevronDown, ChevronUp, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isWelcomePopupCoupon, stripWelcomePopupCouponMarker } from "@/features/coupons/lib/welcome-popup-coupon";
import { formatArs } from "@/lib/utils/currency";

type CouponsAdminPanelProps = {
  coupons: CouponListItem[];
};

type CouponListItem = {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountPercentage: number | null;
  fixedDiscountArs: number | null;
  usageType: CouponUsageType;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { orders: number };
};

type ParsedBulkEntry = {
  code: string;
  rawValue: string;
};

type CouponFormState = {
  code: string;
  description: string;
  welcomePopupEnabled: boolean;
  discountType: CouponDiscountType;
  discountPercentage: string;
  fixedDiscountArs: string;
  usageType: CouponUsageType;
  active: boolean;
  bulkEntriesText: string;
};

type CouponGroup = {
  key: string;
  description: string;
  discountLabel: string;
  usageLabel: string;
  statusLabel: string;
  welcomePopupEnabled: boolean;
  couponCount: number;
  usedCount: number;
  coupons: CouponListItem[];
};

const emptyForm: CouponFormState = {
  code: "",
  description: "",
  welcomePopupEnabled: false,
  discountType: "PERCENTAGE",
  discountPercentage: "10",
  fixedDiscountArs: "",
  usageType: "UNLIMITED",
  active: true,
  bulkEntriesText: "",
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

const discountTypeLabels: Record<CouponDiscountType, string> = {
  PERCENTAGE: "Porcentaje",
  FIXED_AMOUNT: "Monto fijo",
};

export function CouponsAdminPanel({ coupons }: CouponsAdminPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [form, setForm] = useState<CouponFormState>(emptyForm);

  const editingCoupon = useMemo(
    () => coupons.find((coupon) => coupon.id === editingCouponId) ?? null,
    [coupons, editingCouponId],
  );
  const parsedBulkEntries = useMemo(() => parseBulkEntries(form.bulkEntriesText), [form.bulkEntriesText]);
  const isBulkMode = !editingCouponId && parsedBulkEntries.length > 0;
  const welcomePopupCoupon = useMemo(
    () => coupons.find((coupon) => coupon.active && isWelcomePopupCoupon(coupon.description)) ?? null,
    [coupons],
  );
  const welcomeCouponCode = welcomePopupCoupon?.code ?? null;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredCoupons = useMemo(() => {
    if (!normalizedSearch) {
      return coupons;
    }

    return coupons.filter((coupon) => {
      const visibleDescription = stripWelcomePopupCouponMarker(coupon.description).toLowerCase();
      const usageLabel = usageLabels[coupon.usageType].toLowerCase();
      const discountLabel = getCouponDiscountText(coupon).toLowerCase();

      return [coupon.code.toLowerCase(), visibleDescription, usageLabel, discountLabel].some((value) =>
        value.includes(normalizedSearch),
      );
    });
  }, [coupons, normalizedSearch]);
  const groupedCoupons = useMemo(() => buildCouponGroups(filteredCoupons), [filteredCoupons]);

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
      description: stripWelcomePopupCouponMarker(coupon.description),
      welcomePopupEnabled: isWelcomePopupCoupon(coupon.description),
      discountType: coupon.discountType,
      discountPercentage: coupon.discountPercentage?.toString() ?? "",
      fixedDiscountArs: coupon.fixedDiscountArs?.toString() ?? "",
      usageType: coupon.usageType,
      active: coupon.active,
      bulkEntriesText: "",
    });
    setError(null);
    setMessage(null);
  }

  function toggleGroup(groupKey: string) {
    setExpandedGroups((current) =>
      current.includes(groupKey) ? current.filter((value) => value !== groupKey) : [...current, groupKey],
    );
  }

  async function submitForm() {
    const url = editingCouponId ? `/api/admin/coupons/${editingCouponId}` : "/api/admin/coupons";
    const method = editingCouponId ? "PATCH" : "POST";
    const body = isBulkMode
      ? {
          entries: parsedBulkEntries.map((entry) => ({
            code: entry.code,
            discountPercentage: form.discountType === "PERCENTAGE" ? entry.rawValue : undefined,
            fixedDiscountArs: form.discountType === "FIXED_AMOUNT" ? entry.rawValue : undefined,
          })),
          description: form.description,
          discountType: form.discountType,
          usageType: form.usageType,
          active: form.active,
          welcomePopupEnabled: false,
        }
      : {
          code: form.code,
          description: form.description,
          discountType: form.discountType,
          discountPercentage: form.discountType === "PERCENTAGE" ? form.discountPercentage : undefined,
          fixedDiscountArs: form.discountType === "FIXED_AMOUNT" ? form.fixedDiscountArs : undefined,
          usageType: form.usageType,
          active: form.active,
          welcomePopupEnabled: form.welcomePopupEnabled,
        };

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      error?: string;
      data?: { created?: number; updated?: number };
    };

    if (!response.ok) {
      setError(payload.error ?? "No pudimos guardar el cupón.");
      return;
    }

    const createdCount = payload.data?.created ?? 0;
    setMessage(
      editingCouponId
        ? "Cupón actualizado."
        : `${createdCount} cupón${createdCount === 1 ? "" : "es"} creado${createdCount === 1 ? "" : "s"}.`,
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
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-ink/70 md:text-base">
          Crea códigos con porcentaje o monto fijo, con uso ilimitado, un uso total o un uso por DNI.
        </p>
      </div>

      <Card className="border border-brand-pink/15 bg-brand-pinkSoft/30 p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-white p-2 text-brand-pink shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand-pink">Popup de bienvenida</p>
            <p className="mt-2 text-sm leading-6 text-brand-ink/70">
              Marcá un solo cupón activo para usarlo en el popup del home y en el email inmediato de bienvenida.
            </p>
            <p className="mt-2 text-sm font-bold text-brand-ink">
              {welcomeCouponCode ? `Cupón actual del popup: ${welcomeCouponCode}` : "Todavía no hay un cupón marcado para el popup."}
            </p>
          </div>
        </div>
      </Card>

      {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card className="space-y-5 p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">
                {editingCoupon ? "Editar cupón" : "Nuevo cupón"}
              </p>
              <p className="mt-2 text-sm text-brand-ink/70">
                Podés crear uno individual o una tanda masiva con valores distintos por fila.
              </p>
            </div>
            {editingCoupon ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancelar
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo de descuento">
                <select
                  value={form.discountType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      discountType: event.target.value as CouponDiscountType,
                    }))
                  }
                  className="h-12 w-full rounded-2xl border border-brand-ink/10 bg-white px-4 text-sm text-brand-ink outline-none transition focus:border-brand-pink/40 focus:ring-2 focus:ring-brand-pink/20"
                >
                  {Object.entries(discountTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={form.discountType === "PERCENTAGE" ? "Descuento (%)" : "Monto fijo (ARS)"}>
                <Input
                  type="number"
                  step={form.discountType === "PERCENTAGE" ? "0.01" : "1"}
                  min={form.discountType === "PERCENTAGE" ? "0.01" : "1"}
                  max={form.discountType === "PERCENTAGE" ? "100" : undefined}
                  value={form.discountType === "PERCENTAGE" ? form.discountPercentage : form.fixedDiscountArs}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [form.discountType === "PERCENTAGE" ? "discountPercentage" : "fixedDiscountArs"]: event.target.value,
                    }))
                  }
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Código">
                <Input
                  value={form.code}
                  maxLength={40}
                  placeholder={form.discountType === "PERCENTAGE" ? "BIENVENIDA10" : "REGALO1500"}
                  disabled={isBulkMode}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
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

            {!editingCoupon ? (
              <Field label={form.discountType === "PERCENTAGE" ? "Carga masiva (CODIGO, %)" : "Carga masiva (CODIGO, monto ARS)"}>
                <Textarea
                  rows={7}
                  value={form.bulkEntriesText}
                  placeholder={
                    form.discountType === "PERCENTAGE"
                      ? "INFLUENCER01,10\nINFLUENCER02,15\nINFLUENCER03,20"
                      : "REGALO1500A,1500\nREGALO2500B,2500\nREGALO5000C,5000"
                  }
                  onChange={(event) =>
                    setForm((current) => ({ ...current, bulkEntriesText: event.target.value.toUpperCase() }))
                  }
                />
                <p className="mt-2 text-xs font-bold text-brand-ink/45">
                  Una fila por cupón. Separa código y valor con coma, punto y coma o tab. Detectados: {parsedBulkEntries.length || 0}.
                </p>
              </Field>
            ) : null}

            <p className="rounded-2xl bg-background px-4 py-3 text-xs font-bold leading-5 text-brand-ink/60">
              {usageHelp[form.usageType]}
            </p>

            <Field label="Descripción interna">
              <Input
                value={form.description}
                maxLength={160}
                placeholder="Campaña agosto 2026"
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </Field>

            <Checkbox
              label="Usar este cupón en el popup de bienvenida"
              checked={form.welcomePopupEnabled}
              disabled={isBulkMode}
              onChange={(event) => setForm((current) => ({ ...current, welcomePopupEnabled: event.target.checked }))}
            />
            {form.welcomePopupEnabled ? (
              <p className="text-xs font-bold leading-5 text-brand-ink/55">
                Este cupón será el que se muestra en el home y el que se envía por email cuando una persona deja su correo por primera vez.
              </p>
            ) : null}

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
            {isPending
              ? "Guardando..."
              : editingCoupon
                ? "Guardar cambios"
                : isBulkMode
                  ? `Crear ${parsedBulkEntries.length} cupones`
                  : "Crear cupón"}
          </Button>
        </Card>

        <Card className="space-y-4 p-5 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Listado actual</p>
              <p className="mt-2 text-sm text-brand-ink/70">
                {filteredCoupons.length} cupones visibles en {groupedCoupons.length} grupos.
              </p>
            </div>
            <div className="rounded-full bg-brand-peach px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-pink">
              Nunca descuenta envío
            </div>
          </div>

          <Field label="Buscar por código, descripción o beneficio">
            <Input
              value={searchTerm}
              placeholder="Ej: INFLUENCER, BIENVENIDA, 10%, $10.000"
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </Field>

          <div className="space-y-3">
            {groupedCoupons.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-brand-ink/15 p-6 text-sm text-brand-ink/55">
                No encontramos cupones para ese filtro.
              </div>
            ) : (
              groupedCoupons.map((group) => {
                const isExpanded = expandedGroups.includes(group.key);

                return (
                  <div key={group.key} className="rounded-[1.5rem] border border-brand-ink/10 bg-background p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-brand-ink">{group.description}</p>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-pink">
                            {group.discountLabel}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-ink/55">
                            {group.usageLabel}
                          </span>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-ink/55">
                            {group.statusLabel}
                          </span>
                          {group.welcomePopupEnabled ? (
                            <span className="rounded-full bg-brand-pink px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white">
                              Popup bienvenida
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-2 text-sm text-brand-ink/65">
                          {group.couponCount} cupón{group.couponCount === 1 ? "" : "es"} en este grupo · {group.usedCount} uso{group.usedCount === 1 ? "" : "s"} confirmado{group.usedCount === 1 ? "" : "s"}.
                        </p>

                        {!isExpanded ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {group.coupons.slice(0, 8).map((coupon) => (
                              <span key={coupon.id} className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-ink/70 ring-1 ring-brand-ink/8">
                                {coupon.code}
                              </span>
                            ))}
                            {group.couponCount > 8 ? (
                              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-ink/55 ring-1 ring-brand-ink/8">
                                +{group.couponCount - 8} más
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <Button type="button" variant="secondary" size="sm" onClick={() => toggleGroup(group.key)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>

                    {isExpanded ? (
                      <div className="mt-3 space-y-2 border-t border-brand-ink/8 pt-3">
                        {group.coupons.map((coupon) => {
                          const isEditing = coupon.id === editingCouponId;
                          const usedCount = coupon._count?.orders ?? 0;
                          const isWelcomeCoupon = isWelcomePopupCoupon(coupon.description);

                          return (
                            <div
                              key={coupon.id}
                              className={`rounded-[1rem] border px-4 py-3 transition ${
                                isEditing ? "border-brand-pink bg-brand-pink/5" : "border-brand-ink/8 bg-white"
                              }`}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-bold uppercase tracking-[0.14em] text-brand-ink">{coupon.code}</p>
                                    <span className="text-sm font-bold text-brand-pink">{getCouponDiscountText(coupon)}</span>
                                    {isWelcomeCoupon ? (
                                      <span className="rounded-full bg-brand-pink/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-pink">
                                        Popup
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-xs text-brand-ink/55">
                                    {coupon.active ? "Activo" : "Pausado"} · {usedCount} usos confirmados
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
                        })}
                      </div>
                    ) : null}
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

function buildCouponGroups(coupons: CouponListItem[]): CouponGroup[] {
  const groups = new Map<string, CouponGroup>();

  for (const coupon of coupons) {
    const visibleDescription = stripWelcomePopupCouponMarker(coupon.description) || "Sin descripción interna";
    const discountLabel = getCouponDiscountText(coupon);
    const usageLabel = usageLabels[coupon.usageType];
    const welcomePopupEnabled = isWelcomePopupCoupon(coupon.description);
    const groupKey = [visibleDescription, discountLabel, coupon.usageType, coupon.active ? "active" : "paused", welcomePopupEnabled ? "welcome" : "normal"].join("::");
    const existing = groups.get(groupKey);

    if (existing) {
      existing.couponCount += 1;
      existing.usedCount += coupon._count?.orders ?? 0;
      existing.coupons.push(coupon);
      continue;
    }

    groups.set(groupKey, {
      key: groupKey,
      description: visibleDescription,
      discountLabel,
      usageLabel,
      statusLabel: coupon.active ? "Activos" : "Pausados",
      welcomePopupEnabled,
      couponCount: 1,
      usedCount: coupon._count?.orders ?? 0,
      coupons: [coupon],
    });
  }

  return Array.from(groups.values()).sort((a, b) => {
    const welcomeDiff = Number(b.welcomePopupEnabled) - Number(a.welcomePopupEnabled);
    if (welcomeDiff !== 0) {
      return welcomeDiff;
    }

    const sizeDiff = b.couponCount - a.couponCount;
    if (sizeDiff !== 0) {
      return sizeDiff;
    }

    return a.description.localeCompare(b.description, "es");
  });
}

function getCouponDiscountText(coupon: Pick<CouponListItem, "discountType" | "discountPercentage" | "fixedDiscountArs">) {
  return coupon.discountType === "FIXED_AMOUNT"
    ? `${formatArs(coupon.fixedDiscountArs ?? 0)} OFF`
    : `${coupon.discountPercentage ?? 0}% OFF`;
}

function parseBulkEntries(value: string): ParsedBulkEntry[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [codePart = "", valuePart = ""] = line.split(/[,\t;]+/);

      return {
        code: codePart.trim().toUpperCase(),
        rawValue: valuePart.trim().replace(",", "."),
      };
    })
    .filter((entry) => entry.code && entry.rawValue);
}


function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-bold text-brand-ink/75">{label}</span>
      {children}
    </label>
  );
}