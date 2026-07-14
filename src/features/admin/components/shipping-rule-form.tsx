"use client";

import type { ShippingRule, ShippingRuleProvince } from "@prisma/client";
import { ShippingMode } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ARGENTINA_PROVINCES, normalizeProvinceName } from "@/lib/constants/provinces";

type ShippingRuleFormProps = {
  rule: ShippingRule & { provinces: ShippingRuleProvince[] };
};

export function ShippingRuleForm({ rule }: ShippingRuleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: rule.name,
    description: rule.description ?? "",
    mode: rule.mode,
    flatPrice: rule.flatPrice ?? 0,
    discountThresholdArs: rule.discountThresholdArs?.toString() ?? "",
    discountPercentage: rule.discountPercentage?.toString() ?? "",
    active: rule.active,
    isDefault: rule.isDefault,
  });
  const [provinces, setProvinces] = useState(() => {
    const provinceMap = new Map(
      rule.provinces.map((province) => [province.provinceCode, province]),
    );

    return ARGENTINA_PROVINCES.map((province) => {
      const existingProvince = provinceMap.get(province.code);

      if (existingProvince) {
        return {
          ...existingProvince,
          provinceName: province.name,
        };
      }

      const matchedByName = rule.provinces.find(
        (entry) => normalizeProvinceName(entry.provinceName) === normalizeProvinceName(province.name),
      );

      if (matchedByName) {
        return {
          ...matchedByName,
          provinceCode: province.code,
          provinceName: province.name,
        };
      }

      return {
        id: `draft-${province.code}`,
        shippingRuleId: rule.id,
        provinceCode: province.code,
        provinceName: province.name,
        shippingPrice: province.shippingPrice,
        active: true,
      };
    });
  });

  return (
    <Card className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="font-display text-3xl text-brand-ink md:text-4xl">Reglas de envío</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        <Select value={form.mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as ShippingMode }))}>
          {Object.values(ShippingMode).map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </Select>
        <Input type="number" value={form.flatPrice} onChange={(event) => setForm((current) => ({ ...current, flatPrice: Number(event.target.value) }))} />
        <Checkbox label="Activa" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
        <Checkbox label="Por defecto" checked={form.isDefault} onChange={(event) => setForm((current) => ({ ...current, isDefault: event.target.checked }))} />
      </div>
      <div className="rounded-[1.5rem] border border-brand-pink/15 bg-brand-pink/5 p-4">
        <div className="mb-4">
          <h2 className="text-base font-extrabold text-brand-ink">Descuento parcial de envio</h2>
          <p className="mt-1 text-sm leading-6 text-brand-ink/60">
            Opcional. Se aplica cuando el subtotal supera este minimo y todavia no llega al envio gratis.
            Si el pedido llega al envio gratis, el envio queda en $0 como siempre.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-bold text-brand-ink">Activar descuento desde</span>
            <Input
              type="number"
              min={0}
              placeholder="Ej: 40000"
              value={form.discountThresholdArs}
              onChange={(event) => setForm((current) => ({ ...current, discountThresholdArs: event.target.value }))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-bold text-brand-ink">% de descuento sobre el envio</span>
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="Ej: 50"
              value={form.discountPercentage}
              onChange={(event) => setForm((current) => ({ ...current, discountPercentage: event.target.value }))}
            />
          </label>
        </div>
      </div>
      <div className="space-y-3">
        {provinces.map((province, index) => (
          <div key={province.id} className="grid gap-3 rounded-[1.5rem] bg-background p-4 md:grid-cols-[1fr_140px_100px]">
            <div>
              <p className="font-bold text-brand-ink">{province.provinceName}</p>
              <p className="text-sm text-brand-ink/60">{province.provinceCode}</p>
            </div>
            <Input
              type="number"
              value={province.shippingPrice}
              onChange={(event) =>
                setProvinces((current) =>
                  current.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, shippingPrice: Number(event.target.value) } : entry,
                  ),
                )
              }
            />
            <Checkbox
              label="Activa"
              checked={province.active}
              onChange={(event) =>
                setProvinces((current) =>
                  current.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, active: event.target.checked } : entry,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>
      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
      <Button
        type="button"
        disabled={isPending}
        className="w-full sm:w-auto"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const response = await fetch(`/api/admin/shipping-rules/${rule.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                rule: {
                  ...form,
                  discountThresholdArs: form.discountThresholdArs.trim() ? Number(form.discountThresholdArs) : null,
                  discountPercentage: form.discountPercentage.trim() ? Number(form.discountPercentage) : null,
                },
                provinces,
              }),
            });
            const payload = await response.json();

            if (!response.ok) {
              setError(payload.error ?? "No pudimos guardar la regla.");
              return;
            }

            router.refresh();
          });
        }}
      >
        {isPending ? "Guardando..." : "Guardar regla"}
      </Button>
    </Card>
  );
}
