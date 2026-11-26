"use client";

import { Truck, Store, MapPin, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { formatArs } from "@/lib/utils/currency";

export type CheckoutShippingOption = {
  id: string;
  carrier: "OWN" | "ANDREANI" | "CORREO_AR";
  deliveryType: "HOME" | "BRANCH";
  label: string;
  carrierPriceArs: number;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  zoneName: string | null;
  arrivalLabel?: string | null;
  estimated: boolean;
};

export type Branch = { id: string; name: string; address: string; locality: string; province: string; postalCode: string; hours?: string };

export type ShippingSelectionValue = { carrier: CheckoutShippingOption["carrier"]; deliveryType: CheckoutShippingOption["deliveryType"]; branchId?: string };

type OptionsState =
  | { status: "idle" | "loading" | "disabled" }
  | { status: "error"; message: string }
  | { status: "ready"; options: CheckoutShippingOption[]; dispatchDateLabel: string };

type RequestItem = { productId?: string; wholesaleProductId?: string; quantity: number; selection?: { productId: string; quantity: number }[] };

// Pide al servidor las opciones de envío para el CP. Espera a que el CP tenga 4 números y la provincia esté elegida.
export function useShippingOptions(input: {
  enabled: boolean;
  channel: "RETAIL" | "WHOLESALE";
  postalCode: string;
  province: string;
  locality: string;
  items: RequestItem[];
  wholesaleCustomerId?: string | null;
}) {
  const [state, setState] = useState<OptionsState>({ status: "idle" });
  const postalCode = (input.postalCode ?? "").replace(/\D/g, "");
  const itemsKey = JSON.stringify(input.items);

  useEffect(() => {
    if (!input.enabled || postalCode.length < 4 || !input.province || input.items.length === 0) {
      setState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState({ status: "loading" });
      try {
        const response = await fetch("/api/shipping/options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            channel: input.channel,
            postalCode,
            province: input.province,
            locality: input.locality ?? "",
            items: input.items,
            wholesaleCustomerId: input.wholesaleCustomerId ?? undefined,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          setState({ status: "error", message: payload.error ?? "No pudimos calcular el envío." });
          return;
        }
        if (!payload.data?.enabled) {
          setState({ status: "disabled" });
          return;
        }
        setState({ status: "ready", options: payload.data.options, dispatchDateLabel: payload.data.dispatchDateLabel });
      } catch (error) {
        if ((error as Error).name !== "AbortError") setState({ status: "error", message: "No pudimos calcular el envío. Revisá tu conexión." });
      }
    }, 450);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
    // itemsKey resume los ítems; input.items cambia de referencia en cada render.
  }, [input.enabled, input.channel, postalCode, input.province, input.locality, itemsKey, input.wholesaleCustomerId]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

function daysLabel(option: CheckoutShippingOption) {
  const { deliveryDaysMin: min, deliveryDaysMax: max } = option;
  if (!min && !max) return null;
  if (min === max || !max) return `Llega en ${min} día${min === 1 ? "" : "s"} hábil${min === 1 ? "" : "es"}`;
  if (!min) return `Llega en hasta ${max} días hábiles`;
  return `Llega en ${min} a ${max} días hábiles`;
}

type PickerProps = {
  state: OptionsState;
  value: ShippingSelectionValue | null;
  onChange: (value: ShippingSelectionValue | null) => void;
  postalCode: string;
  province: string;
  // El precio final de la opción elegida (con envío gratis o descuento), para mostrarlo al lado.
  freeShipping?: boolean;
  error?: string | null;
  onBranchChange?: (branch: Branch | null) => void;
};

export function ShippingPicker({ state, value, onChange, postalCode, province, freeShipping, error, onBranchChange }: PickerProps) {
  const [branches, setBranches] = useState<{ key: string; list: Branch[]; status: "loading" | "ready" | "error" } | null>(null);
  const options = useMemo(() => (state.status === "ready" ? state.options : []), [state]);
  const selected = useMemo(() => options.find((option) => option.carrier === value?.carrier && option.deliveryType === value?.deliveryType) ?? null, [options, value]);
  const lastOptionsKey = useRef("");

  // Al cambiar las opciones, se mantiene la elección si sigue estando; si no, la primera.
  useEffect(() => {
    if (state.status !== "ready") {
      if (state.status !== "loading" && value) onChange(null);
      return;
    }
    const key = state.options.map((option) => option.id).join(",");
    if (key === lastOptionsKey.current && selected) return;
    lastOptionsKey.current = key;
    if (!selected && state.options[0]) {
      onChange({ carrier: state.options[0].carrier, deliveryType: state.options[0].deliveryType });
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sucursales del transportista elegido.
  useEffect(() => {
    if (!selected || selected.deliveryType !== "BRANCH" || selected.carrier === "OWN") return;
    const cp = postalCode.replace(/\D/g, "");
    const key = `${selected.carrier}|${cp}|${province}`;
    if (branches?.key === key && branches.status !== "error") return;
    const controller = new AbortController();
    setBranches({ key, list: [], status: "loading" });
    fetch(`/api/shipping/branches?${new URLSearchParams({ carrier: selected.carrier, postalCode: cp, province })}`, { signal: controller.signal })
      .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
      .then(({ ok, payload }) => setBranches({ key, list: ok ? payload.data ?? [] : [], status: ok ? "ready" : "error" }))
      .catch((err) => {
        if ((err as Error).name !== "AbortError") setBranches({ key, list: [], status: "error" });
      });
    return () => controller.abort();
  }, [selected?.carrier, selected?.deliveryType, postalCode, province]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.status === "idle") {
    return <p className="rounded-2xl bg-brand-ink/5 p-4 text-sm text-brand-ink/60">Completá el código postal para ver cómo te llega y cuándo sale.</p>;
  }
  if (state.status === "loading") {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-brand-ink/5 p-4 text-sm text-brand-ink/70">
        <Loader2 className="h-4 w-4 animate-spin" /> Calculando el envío...
      </p>
    );
  }
  if (state.status === "disabled") return null;
  if (state.status === "error") return <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{state.message}</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm font-extrabold text-brand-ink">¿Cómo te llega?</p>
      <div className="space-y-2" role="radiogroup" aria-label="Opciones de envío">
        {options.map((option) => {
          const active = selected?.id === option.id;
          const Icon = option.deliveryType === "BRANCH" ? Store : Truck;
          const days = daysLabel(option);
          const isBranch = option.deliveryType === "BRANCH";
          const title = option.carrier === "OWN" ? "Envío a domicilio" : isBranch ? "Retiro en sucursal" : "Envío a domicilio";
          const arrival = option.arrivalLabel
            ? `${isBranch ? "Lo retirás" : "Llega"} ${option.arrivalLabel}`
            : days
              ? `${days} desde el despacho`
              : null;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange({ carrier: option.carrier, deliveryType: option.deliveryType })}
              className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                active ? "border-brand-pink bg-brand-pinkSoft/30" : "border-brand-ink/10 bg-white hover:border-brand-pink/50"
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-brand-pink" : "border-brand-ink/25"}`}
              >
                {active ? <span className="h-2.5 w-2.5 rounded-full bg-brand-pink" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-extrabold text-brand-ink">
                  <Icon className="h-4 w-4 shrink-0 text-brand-ink/50" />
                  {title}
                  {option.zoneName && option.carrier === "OWN" ? <span className="font-semibold text-brand-ink/55">· {option.zoneName}</span> : null}
                </span>
                {arrival ? <span className="mt-0.5 block text-sm font-bold text-emerald-700">{freeShipping ? `${arrival.replace(/^Llega/, "Llega gratis")}` : arrival}</span> : null}
                <span className="mt-1 flex items-center gap-1.5 text-xs text-brand-ink/55">
                  {option.carrier === "ANDREANI" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="/brand/andreani-logo.png" alt="Andreani" width={88} height={16} className="h-4 w-auto" />
                  ) : option.carrier === "OWN" ? (
                    <span className="font-bold text-brand-pink">Reparto IQ Kids</span>
                  ) : (
                    <span className="font-bold">Correo Argentino</span>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-sm font-extrabold text-brand-ink">
                {freeShipping ? (
                  <span className="flex flex-col items-end leading-tight">
                    <span className="text-xs font-bold text-brand-ink/35 line-through">{formatArs(option.carrierPriceArs)}</span>
                    <span className="text-emerald-700">Gratis</span>
                  </span>
                ) : (
                  formatArs(option.carrierPriceArs)
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selected?.deliveryType === "BRANCH" ? (
        <div className="space-y-1">
          <label className="text-sm font-extrabold text-brand-ink" htmlFor="shipping-branch">Sucursal donde retirás</label>
          {branches?.status === "loading" ? (
            <p className="flex items-center gap-2 text-sm text-brand-ink/60"><Loader2 className="h-4 w-4 animate-spin" /> Buscando sucursales...</p>
          ) : branches && branches.list.length > 0 ? (
            <select
              id="shipping-branch"
              className="h-12 w-full rounded-2xl border border-brand-ink/15 bg-white px-4 text-sm"
              value={value?.branchId ?? ""}
              onChange={(event) => {
                if (!value) return;
                onChange({ ...value, branchId: event.target.value || undefined });
                onBranchChange?.(branches.list.find((b) => b.id === event.target.value) ?? null);
              }}
            >
              <option value="">Elegí una sucursal</option>
              {branches.list.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name} · {branch.address}, {branch.locality}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm font-bold text-red-700">No encontramos sucursales para este código postal. Elegí envío a domicilio.</p>
          )}
          {value?.branchId ? (
            <p className="flex items-start gap-1 text-xs text-brand-ink/60">
              <MapPin className="mt-0.5 h-3.5 w-3.5" />
              {(() => {
                const branch = branches?.list.find((b) => b.id === value.branchId);
                return branch ? `${branch.address}, ${branch.locality}${branch.hours ? ` · ${branch.hours}` : ""}` : null;
              })()}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="px-1 text-xs text-brand-ink/55">
        Las fechas cuentan desde que se acredita el pago. Si se confirma hoy, sale de nuestro depósito el {state.status === "ready" ? state.dispatchDateLabel : ""}.
      </p>
      {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
    </div>
  );
}
