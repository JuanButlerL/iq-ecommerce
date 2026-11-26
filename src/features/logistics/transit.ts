import { addBusinessDays, addDays, formatDispatchDate, toArgentinaDateKey, type DateKey, type HolidayCalendar } from "@/features/logistics/business-days";

export type TransitDays = {
  transitDaysAmbaMin: number;
  transitDaysAmbaMax: number;
  transitDaysBsasMin: number;
  transitDaysBsasMax: number;
  transitDaysRestMin: number;
  transitDaysRestMax: number;
};

export type TransitRegion = "AMBA" | "BSAS" | "REST";

export const TRANSIT_REGION_LABELS: Record<TransitRegion, string> = {
  AMBA: "CABA y GBA",
  BSAS: "Resto de Buenos Aires",
  REST: "Resto del país",
};

// La provincia sale del CP: CABA (1000-1499) y GBA (1600-1899) son AMBA.
export function transitRegion(province: string): TransitRegion {
  if (province === "CABA" || province === "GBA") return "AMBA";
  if (province === "Buenos Aires") return "BSAS";
  return "REST";
}

export function carrierTransitDays(province: string, days: TransitDays): [number, number] {
  const region = transitRegion(province);
  const [min, max] =
    region === "AMBA"
      ? [days.transitDaysAmbaMin, days.transitDaysAmbaMax]
      : region === "BSAS"
        ? [days.transitDaysBsasMin, days.transitDaysBsasMax]
        : [days.transitDaysRestMin, days.transitDaysRestMax];
  return [Math.max(0, Math.min(min, max)), Math.max(0, Math.max(min, max))];
}

// Agrega la franja del reparto propio: "hoy, jueves 26/11, entre las 14 y las 17 h".
export function withWindow(label: string, window: string | null | undefined) {
  const clean = (window ?? "").trim();
  return clean ? `${label}, ${clean}` : label;
}

// "el viernes 27/11" o "entre el lunes 30/11 y el miércoles 02/12": días hábiles desde el despacho.
export function arrivalRange(dispatchDate: DateKey, min: number, max: number, calendar: HolidayCalendar, now: Date = new Date()) {
  const from = addBusinessDays(dispatchDate, Math.max(0, min), calendar);
  const to = addBusinessDays(dispatchDate, Math.max(0, max), calendar);
  // "hoy, jueves 26/11" / "mañana, viernes 27/11" cuando corresponde (reparto en el día).
  const today = toArgentinaDateKey(now);
  const day = (key: DateKey) =>
    key === today ? `hoy, ${formatDispatchDate(key)}` : key === addDays(today, 1) ? `mañana, ${formatDispatchDate(key)}` : `el ${formatDispatchDate(key)}`;
  return {
    from,
    to,
    label: from === to ? day(from) : `entre ${day(from)} y ${day(to)}`,
  };
}
