export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";
const ARGENTINA_UTC_OFFSET_HOURS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export function formatArgentinaDateTime(value: Date) {
  return value.toLocaleString("es-AR", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatArgentinaDate(value: Date) {
  return value.toLocaleDateString("es-AR", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function parseArgentinaDateParam(value: string | null, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);
  const utcTime = endOfDay
    ? Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999)
    : Date.UTC(year, month - 1, day, 3, 0, 0, 0);
  const date = new Date(utcTime);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function getArgentinaDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ARGENTINA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

export function getArgentinaDateKey(value: Date) {
  const { year, month, day } = getArgentinaDateParts(value);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getArgentinaMonthKey(value: Date) {
  const { year, month } = getArgentinaDateParts(value);

  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getArgentinaStartOfDay(value = new Date()) {
  return parseArgentinaDateParam(getArgentinaDateKey(value)) ?? new Date(value);
}

export function getArgentinaStartOfMonth(value = new Date()) {
  const { year, month } = getArgentinaDateParts(value);

  return parseArgentinaDateParam(`${year}-${String(month).padStart(2, "0")}-01`) ?? new Date(value);
}

export function addArgentinaDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

export function getArgentinaMonthStart(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1, ARGENTINA_UTC_OFFSET_HOURS, 0, 0, 0));
}

export function formatArgentinaDayLabel(value: Date) {
  return value.toLocaleDateString("es-AR", {
    timeZone: ARGENTINA_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatArgentinaMonthLabel(value: Date) {
  return value
    .toLocaleDateString("es-AR", {
      timeZone: ARGENTINA_TIME_ZONE,
      month: "short",
    })
    .replace(".", "");
}
