export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

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
