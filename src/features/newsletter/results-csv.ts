import { addArgentinaDays, getArgentinaDateKey, getArgentinaStartOfDay, parseArgentinaDateParam } from "@/lib/utils/datetime";

// Excel in Spanish (Argentina) expects ";" between columns and "," for decimals.
export const CSV_SEPARATOR = ";";

export function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : typeof value === "number" ? value.toLocaleString("es-AR", { useGrouping: false, maximumFractionDigits: 1 }) : value;
  // Prevent spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

// Period of the overview, by sending date. Defaults to the last 30 days.
export function parseResultsRange(params: { desde?: string | null; hasta?: string | null }) {
  const defaultFrom = addArgentinaDays(getArgentinaStartOfDay(), -29);
  const from = parseArgentinaDateParam(params.desde ?? null) ?? defaultFrom;
  const to = parseArgentinaDateParam(params.hasta ?? null, true) ?? (parseArgentinaDateParam(getArgentinaDateKey(new Date()), true) as Date);
  return { from, to, desde: getArgentinaDateKey(from), hasta: getArgentinaDateKey(to) };
}
