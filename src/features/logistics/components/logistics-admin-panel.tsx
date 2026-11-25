"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { LogisticsAdminData } from "@/features/logistics/admin";

type Props = { data: LogisticsAdminData };

type Zone = LogisticsAdminData["zones"][number];
type Warehouse = LogisticsAdminData["warehouses"][number];
type PostalRow = { id: string; postalCode: string; locality: string; province: string; ownZone: { id: string; name: string } | null };

const emptyWarehouse = {
  name: "Depósito principal",
  contactName: "IQ Kids",
  phone: "",
  email: "",
  taxId: "",
  street: "",
  number: "",
  floor: "",
  locality: "",
  province: "",
  postalCode: "",
  isDefault: true,
  active: true,
};

async function callAdmin(action: string, data?: unknown, id?: string) {
  const response = await fetch("/api/admin/logistics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data, id }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "No se pudo guardar.");
  return payload.data;
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${ok ? "bg-brand-mint text-green-800" : "bg-red-50 text-red-700"}`}>
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

export function LogisticsAdminPanel({ data }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState(data.settings);
  const [zones, setZones] = useState<Zone[]>(data.zones);
  const [newZone, setNewZone] = useState({ name: "", priceArs: 0, wholesalePriceArs: "" as number | "", deliveryDaysMin: 1, deliveryDaysMax: 2 });
  const [warehouse, setWarehouse] = useState<typeof emptyWarehouse & { id?: string }>(() => {
    const current = data.warehouses[0] as Warehouse | undefined;
    return current ? { ...current, taxId: current.taxId ?? "", floor: current.floor ?? "" } : emptyWarehouse;
  });
  const [holiday, setHoliday] = useState({ date: "", name: "" });
  const [postalQuery, setPostalQuery] = useState("");
  const [postalRows, setPostalRows] = useState<PostalRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignZone, setAssignZone] = useState<string>("");

  function run(task: () => Promise<unknown>, success: string | ((result: unknown) => string), refresh = true) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await task();
        setMessage(typeof success === "function" ? success(result) : success);
        if (refresh) router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  const set = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => setSettings({ ...settings, [key]: value });
  const num = (value: string) => (value === "" ? 0 : Number(value));

  function saveSettings(event: FormEvent) {
    event.preventDefault();
    const payload = Object.fromEntries(Object.entries(settings).filter(([key]) => key !== "id" && key !== "updatedAt"));
    run(() => callAdmin("settings", payload), "Configuración guardada.");
  }

  function saveWarehouse(event: FormEvent) {
    event.preventDefault();
    const { id, ...payload } = warehouse;
    const clean = Object.fromEntries(Object.entries(payload).filter(([key]) => !["createdAt", "updatedAt"].includes(key)));
    run(() => callAdmin("warehouse-save", clean, id), "Depósito guardado.");
  }

  function updateZoneField(id: string, patch: Partial<Zone>) {
    setZones(zones.map((zone) => (zone.id === id ? { ...zone, ...patch } : zone)));
  }

  function saveZone(zone: Zone) {
    run(
      () =>
        callAdmin(
          "zone-update",
          {
            name: zone.name,
            priceArs: zone.priceArs,
            wholesalePriceArs: zone.wholesalePriceArs ?? "",
            deliveryDaysMin: zone.deliveryDaysMin,
            deliveryDaysMax: zone.deliveryDaysMax,
            active: zone.active,
            sortOrder: zone.sortOrder,
          },
          zone.id,
        ),
      `Zona ${zone.name} guardada.`,
    );
  }

  function createZone(event: FormEvent) {
    event.preventDefault();
    run(() => callAdmin("zone-create", { ...newZone, active: true, sortOrder: zones.length }), "Zona creada.");
    setNewZone({ name: "", priceArs: 0, wholesalePriceArs: "", deliveryDaysMin: 1, deliveryDaysMax: 2 });
  }

  function removeZone(zone: Zone) {
    if (!window.confirm(`¿Borrar la zona ${zone.name}? Sus ${zone.postalCodes} CP dejan de ser de reparto propio.`)) return;
    run(() => callAdmin("zone-delete", undefined, zone.id), "Zona borrada.");
  }

  function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    run(
      async () => callAdmin("postal-import", { csv: await file.text() }),
      (result) => {
        const r = result as { rows: number; created: number; updated: number; own: number };
        return `Importados ${r.rows} CP (${r.created} nuevos, ${r.updated} actualizados, ${r.own} de reparto propio). Las zonas nuevas quedan apagadas hasta que les pongas precio.`;
      },
    );
  }

  function searchPostal(event?: FormEvent) {
    event?.preventDefault();
    run(
      async () => {
        const rows = (await callAdmin("postal-search", { query: postalQuery })) as PostalRow[];
        setPostalRows(rows);
        setSelected(new Set());
        return rows.length;
      },
      (count) => `${count} códigos postales${Number(count) === 200 ? " (se muestran los primeros 200)" : ""}.`,
      false,
    );
  }

  function assignSelected() {
    if (selected.size === 0) return;
    run(
      async () => {
        const result = await callAdmin("postal-assign", { ids: [...selected], zoneId: assignZone || null });
        const rows = (await callAdmin("postal-search", { query: postalQuery })) as PostalRow[];
        setPostalRows(rows);
        setSelected(new Set());
        return result;
      },
      (result) => `${(result as { updated: number }).updated} CP actualizados.`,
    );
  }

  function addHoliday(event: FormEvent) {
    event.preventDefault();
    run(() => callAdmin("holiday-add", holiday), "Feriado agregado.");
    setHoliday({ date: "", name: "" });
  }

  const creds = data.credentials;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-pink">Envíos</p>
        <h1 className="font-display text-4xl text-brand-ink">Logística</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-ink/70">
          Andreani, Correo Argentino y reparto propio. Con la integración apagada, el envío se cobra como hasta ahora con la tabla por provincia y no se generan etiquetas.
        </p>
      </div>

      {error ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-brand-mint p-4 text-sm font-bold text-green-800">{message}</p> : null}

      <Card className="space-y-3 p-5 md:p-6">
        <h2 className="font-display text-2xl text-brand-ink">Conexiones</h2>
        <p className="text-sm text-brand-ink/70">Las credenciales viven en el servidor (.env.production); acá solo se ve si están cargadas.</p>
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-bold text-brand-ink">Andreani ({creds.andreani.environment}):</span>
          <Flag ok={creds.andreani.user} label="usuario" />
          <Flag ok={creds.andreani.clientNumber} label="cliente" />
          <Flag ok={creds.andreani.contractHome} label="contrato domicilio" />
          <Flag ok={creds.andreani.contractBranch} label="contrato sucursal" />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-bold text-brand-ink">Correo Argentino ({creds.correo.environment}):</span>
          <Flag ok={creds.correo.user} label="usuario API" />
          <Flag ok={creds.correo.customerId} label="cuenta MiCorreo" />
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-sm font-bold text-brand-ink">Datos:</span>
          <Flag ok={data.warehouses.some((w) => w.active)} label="depósito de origen" />
          <Flag ok={data.postalCodes.total > 0} label={`${data.postalCodes.total} CP cargados`} />
          <Flag ok={data.zones.some((z) => z.active && z.priceArs > 0)} label={`${data.postalCodes.own} CP de reparto propio`} />
        </div>
      </Card>

      <Card className="p-5 md:p-6">
        <form onSubmit={saveSettings} className="space-y-4">
          <h2 className="font-display text-2xl text-brand-ink">Configuración</h2>
          <label className="flex items-center gap-3 text-sm font-bold text-brand-ink">
            <input type="checkbox" className="h-4 w-4 accent-brand-pink" checked={settings.enabled} onChange={(e) => set("enabled", e.target.checked)} />
            Integración logística activa (precios por transportista, etiquetas y seguimiento)
          </label>
          <div className="grid gap-2 md:grid-cols-4">
            {(
              [
                ["ownEnabled", "Reparto propio"],
                ["andreaniEnabled", "Andreani"],
                ["correoEnabled", "Correo Argentino"],
                ["branchPickupEnabled", "Retiro en sucursal"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-brand-ink">
                <input type="checkbox" className="h-4 w-4 accent-brand-pink" checked={settings[key]} onChange={(e) => set(key, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-1 text-sm font-bold text-brand-ink">
              <span>Hora de corte</span>
              <div className="flex gap-2">
                <Input type="number" min={0} max={23} value={settings.cutoffHour} onChange={(e) => set("cutoffHour", num(e.target.value))} />
                <Input type="number" min={0} max={59} value={settings.cutoffMinute} onChange={(e) => set("cutoffMinute", num(e.target.value))} />
              </div>
              <span className="block text-xs font-normal text-brand-ink/55">Lo confirmado antes sale ese día hábil.</span>
            </label>
            <label className="space-y-1 text-sm font-bold text-brand-ink">
              <span>Días de preparación</span>
              <Input type="number" min={0} max={10} value={settings.preparationBusinessDays} onChange={(e) => set("preparationBusinessDays", num(e.target.value))} />
              <span className="block text-xs font-normal text-brand-ink/55">Días hábiles extra antes de despachar.</span>
            </label>
            <label className="space-y-1 text-sm font-bold text-brand-ink md:col-span-2">
              <span>Precio de Andreani / Correo al cliente</span>
              <select
                className="h-12 w-full rounded-2xl border border-brand-ink/15 bg-white px-4 text-sm"
                value={settings.carrierPricing}
                onChange={(e) => set("carrierPricing", e.target.value)}
              >
                <option value="TABLE">Tabla actual por provincia (Envíos)</option>
                <option value="LIVE">Tarifa real del transportista + recargo</option>
              </select>
              <span className="block text-xs font-normal text-brand-ink/55">
                Con la tabla, el cliente paga lo mismo que hoy aunque elija Andreani o Correo. El reparto propio usa siempre el precio de su zona.
              </span>
            </label>
            <label className="space-y-1 text-sm font-bold text-brand-ink">
              <span>Recargo Andreani ($)</span>
              <Input type="number" min={0} value={settings.andreaniSurchargeArs} onChange={(e) => set("andreaniSurchargeArs", num(e.target.value))} />
              <span className="block text-xs font-normal text-brand-ink/55">Se suma a la tarifa: llevarlo hasta Andreani.</span>
            </label>
            <label className="space-y-1 text-sm font-bold text-brand-ink">
              <span>Descuento sobre tarifa Andreani (%)</span>
              <Input type="number" min={0} max={90} value={settings.andreaniDiscountPct} onChange={(e) => set("andreaniDiscountPct", num(e.target.value))} />
              <span className="block text-xs font-normal text-brand-ink/55">Solo si la API no trae el descuento del contrato. 0 = ninguno.</span>
            </label>
            <label className="space-y-1 text-sm font-bold text-brand-ink">
              <span>Recargo Correo ($)</span>
              <Input type="number" min={0} value={settings.correoSurchargeArs} onChange={(e) => set("correoSurchargeArs", num(e.target.value))} />
              <span className="block text-xs font-normal text-brand-ink/55">Se suma a la tarifa: llevarlo hasta el Correo.</span>
            </label>
            <label className="space-y-1 text-sm font-bold text-brand-ink">
              <span>Cotización guardada (horas)</span>
              <Input type="number" min={1} max={168} value={settings.quoteCacheHours} onChange={(e) => set("quoteCacheHours", num(e.target.value))} />
              <span className="block text-xs font-normal text-brand-ink/55">Cada cuánto se vuelve a pedir el precio.</span>
            </label>
          </div>
          <div>
            <p className="text-sm font-bold text-brand-ink">Paquete por defecto (reservado; hoy los bultos salen de la tabla de displays: 1 display 360 g 10x12x7 cm hasta 10 displays 20x12x35 cm)</p>
            <div className="mt-1 grid grid-cols-2 gap-3 md:grid-cols-4">
              {(
                [
                  ["defaultUnitWeightGrams", "Peso (g)"],
                  ["defaultUnitLengthCm", "Largo (cm)"],
                  ["defaultUnitWidthCm", "Ancho (cm)"],
                  ["defaultUnitHeightCm", "Alto (cm)"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-1 text-xs font-bold text-brand-ink/70">
                  <span>{label}</span>
                  <Input type="number" min={1} value={settings[key]} onChange={(e) => set(key, num(e.target.value))} />
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : "Guardar configuración"}
          </Button>
        </form>
      </Card>

      <Card className="p-5 md:p-6">
        <form onSubmit={saveWarehouse} className="space-y-3">
          <h2 className="font-display text-2xl text-brand-ink">Depósito de origen</h2>
          <p className="text-sm text-brand-ink/70">Es el remitente de las etiquetas de Andreani y Correo.</p>
          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
                ["name", "Nombre"],
                ["contactName", "Remitente (nombre en la etiqueta)"],
                ["taxId", "CUIT"],
                ["phone", "Teléfono"],
                ["email", "Email"],
                ["street", "Calle"],
                ["number", "Altura"],
                ["floor", "Piso / depto"],
                ["locality", "Localidad"],
                ["province", "Provincia"],
                ["postalCode", "Código postal"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-1 text-sm font-bold text-brand-ink">
                <span>{label}</span>
                <Input value={String(warehouse[key] ?? "")} onChange={(e) => setWarehouse({ ...warehouse, [key]: e.target.value })} />
              </label>
            ))}
          </div>
          <Button type="submit" disabled={isPending}>Guardar depósito</Button>
        </form>
      </Card>

      <Card className="space-y-4 p-5 md:p-6">
        <h2 className="font-display text-2xl text-brand-ink">Zonas de reparto propio</h2>
        <p className="text-sm text-brand-ink/70">Cada CP de reparto propio pertenece a una zona. El precio mayorista vacío usa el mismo precio.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs text-brand-ink/55">
              <tr>
                <th className="py-2">Zona</th>
                <th>Precio</th>
                <th>Precio mayorista</th>
                <th>Días entrega</th>
                <th>CP</th>
                <th>Activa</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className="border-t border-brand-ink/5">
                  <td className="py-2 pr-2"><Input value={zone.name} onChange={(e) => updateZoneField(zone.id, { name: e.target.value })} /></td>
                  <td className="pr-2"><Input type="number" min={0} value={zone.priceArs} onChange={(e) => updateZoneField(zone.id, { priceArs: num(e.target.value) })} /></td>
                  <td className="pr-2">
                    <Input
                      type="number"
                      min={0}
                      value={zone.wholesalePriceArs ?? ""}
                      onChange={(e) => updateZoneField(zone.id, { wholesalePriceArs: e.target.value === "" ? null : num(e.target.value) })}
                    />
                  </td>
                  <td className="pr-2">
                    <div className="flex gap-1">
                      <Input type="number" min={0} value={zone.deliveryDaysMin} onChange={(e) => updateZoneField(zone.id, { deliveryDaysMin: num(e.target.value) })} />
                      <Input type="number" min={0} value={zone.deliveryDaysMax} onChange={(e) => updateZoneField(zone.id, { deliveryDaysMax: num(e.target.value) })} />
                    </div>
                  </td>
                  <td className="pr-2 text-brand-ink/70">{zone.postalCodes}</td>
                  <td className="pr-2"><input type="checkbox" className="h-4 w-4 accent-brand-pink" checked={zone.active} onChange={(e) => updateZoneField(zone.id, { active: e.target.checked })} /></td>
                  <td className="whitespace-nowrap">
                    <Button type="button" size="sm" disabled={isPending} onClick={() => saveZone(zone)}>Guardar</Button>{" "}
                    <button type="button" className="text-xs font-bold text-red-600 hover:underline" onClick={() => removeZone(zone)}>Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={createZone} className="grid items-end gap-2 md:grid-cols-6">
          <label className="space-y-1 text-xs font-bold text-brand-ink/70 md:col-span-2"><span>Nueva zona</span><Input required value={newZone.name} placeholder="GBA Norte" onChange={(e) => setNewZone({ ...newZone, name: e.target.value })} /></label>
          <label className="space-y-1 text-xs font-bold text-brand-ink/70"><span>Precio</span><Input type="number" min={0} value={newZone.priceArs} onChange={(e) => setNewZone({ ...newZone, priceArs: num(e.target.value) })} /></label>
          <label className="space-y-1 text-xs font-bold text-brand-ink/70"><span>Mayorista</span><Input type="number" min={0} value={newZone.wholesalePriceArs} onChange={(e) => setNewZone({ ...newZone, wholesalePriceArs: e.target.value === "" ? "" : num(e.target.value) })} /></label>
          <label className="space-y-1 text-xs font-bold text-brand-ink/70"><span>Días</span><div className="flex gap-1"><Input type="number" min={0} value={newZone.deliveryDaysMin} onChange={(e) => setNewZone({ ...newZone, deliveryDaysMin: num(e.target.value) })} /><Input type="number" min={0} value={newZone.deliveryDaysMax} onChange={(e) => setNewZone({ ...newZone, deliveryDaysMax: num(e.target.value) })} /></div></label>
          <Button type="submit" disabled={isPending}>Agregar zona</Button>
        </form>
      </Card>

      <Card className="space-y-4 p-5 md:p-6">
        <h2 className="font-display text-2xl text-brand-ink">Códigos postales</h2>
        <p className="text-sm text-brand-ink/70">
          {data.postalCodes.total} CP cargados, {data.postalCodes.own} de reparto propio. Para importar, descargá la hoja <b>codigos_postales_db</b> como CSV
          (Archivo &gt; Descargar &gt; CSV) y subila acá. Volver a importar no pisa las zonas que ya asignaste.
        </p>
        <label className="inline-flex cursor-pointer items-center rounded-full bg-white px-4 py-2 text-sm font-extrabold text-brand-ink ring-1 ring-brand-ink/10 hover:bg-brand-pinkSoft/30">
          Importar CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} disabled={isPending} />
        </label>
        <form onSubmit={searchPostal} className="flex flex-wrap gap-2">
          <Input className="max-w-sm" placeholder="CP, localidad o provincia" value={postalQuery} onChange={(e) => setPostalQuery(e.target.value)} />
          <Button type="submit" disabled={isPending}>Buscar</Button>
        </form>
        {postalRows.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-bold text-brand-ink">{selected.size} seleccionados →</span>
              <select className="h-10 rounded-xl border border-brand-ink/15 bg-white px-3" value={assignZone} onChange={(e) => setAssignZone(e.target.value)}>
                <option value="">Sin reparto propio</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>{zone.name}</option>
                ))}
              </select>
              <Button type="button" size="sm" disabled={isPending || selected.size === 0} onClick={assignSelected}>Asignar</Button>
              <button type="button" className="text-xs font-bold text-brand-pink hover:underline" onClick={() => setSelected(new Set(postalRows.map((r) => r.id)))}>Seleccionar todos</button>
            </div>
            <div className="max-h-96 overflow-y-auto rounded-xl ring-1 ring-brand-ink/5">
              <table className="w-full text-sm">
                <tbody>
                  {postalRows.map((row) => (
                    <tr key={row.id} className="border-t border-brand-ink/5">
                      <td className="w-8 px-2 py-1.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand-pink"
                          checked={selected.has(row.id)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(row.id);
                            else next.delete(row.id);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td className="font-bold">{row.postalCode}</td>
                      <td>{row.locality}</td>
                      <td className="text-brand-ink/60">{row.province}</td>
                      <td className="pr-2 text-right">{row.ownZone ? <span className="rounded-full bg-brand-mint px-2 py-0.5 text-xs font-bold text-green-800">{row.ownZone.name}</span> : <span className="text-xs text-brand-ink/40">Andreani / Correo</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Card>

      <Card className="space-y-4 p-5 md:p-6">
        <h2 className="font-display text-2xl text-brand-ink">Feriados y días sin despacho</h2>
        <p className="text-sm text-brand-ink/70">Sábados, domingos y feriados nacionales ya se saltean solos. Acá agregás puentes, cambios por decreto o días propios.</p>
        <form onSubmit={addHoliday} className="flex flex-wrap items-end gap-2">
          <label className="space-y-1 text-xs font-bold text-brand-ink/70"><span>Fecha</span><Input type="date" required value={holiday.date} onChange={(e) => setHoliday({ ...holiday, date: e.target.value })} /></label>
          <label className="space-y-1 text-xs font-bold text-brand-ink/70"><span>Motivo</span><Input required value={holiday.name} placeholder="Feriado puente" onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} /></label>
          <Button type="submit" disabled={isPending}>Agregar</Button>
        </form>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-bold text-brand-ink">Cargados en el admin</p>
            {data.holidays.length === 0 ? <p className="text-sm text-brand-ink/50">Ninguno.</p> : null}
            <ul className="space-y-1 text-sm">
              {data.holidays.map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded-xl bg-brand-ink/5 px-3 py-1.5">
                  <span><b>{h.date.split("-").reverse().join("/")}</b> · {h.name}</span>
                  <button type="button" className="text-xs font-bold text-red-600 hover:underline" onClick={() => run(() => callAdmin("holiday-delete", undefined, h.id), "Feriado borrado.")}>Borrar</button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-sm font-bold text-brand-ink">Próximos feriados nacionales (automáticos)</p>
            <ul className="space-y-1 text-sm text-brand-ink/70">
              {data.nationalHolidays.map((h) => (
                <li key={h.date}><b>{h.date.split("-").reverse().join("/")}</b> · {h.name}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
