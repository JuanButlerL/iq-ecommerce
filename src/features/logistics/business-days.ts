// Días hábiles de despacho: sin sábados, domingos, feriados nacionales ni los días cargados en el admin.
// Todo se calcula en hora de Argentina (UTC-3, sin horario de verano) con fechas "YYYY-MM-DD".

const AR_OFFSET_MS = -3 * 60 * 60 * 1000;

export type DateKey = string; // YYYY-MM-DD

export function toArgentinaDateKey(date: Date): DateKey {
  return new Date(date.getTime() + AR_OFFSET_MS).toISOString().slice(0, 10);
}

export function argentinaClock(date: Date) {
  const local = new Date(date.getTime() + AR_OFFSET_MS);
  return { dateKey: local.toISOString().slice(0, 10), hour: local.getUTCHours(), minute: local.getUTCMinutes() };
}

function keyToUtc(key: DateKey) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcToKey(date: Date): DateKey {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = keyToUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return utcToKey(date);
}

export function weekday(key: DateKey) {
  return keyToUtc(key).getUTCDay(); // 0 domingo ... 6 sábado
}

// Domingo de Pascua (algoritmo de Meeus/Butcher).
export function easterSunday(year: number): DateKey {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Ley 27.399: los trasladables que caen martes o miércoles pasan al lunes anterior; jueves o viernes, al lunes siguiente.
function movable(key: DateKey): DateKey {
  const day = weekday(key);
  if (day === 2) return addDays(key, -1);
  if (day === 3) return addDays(key, -2);
  if (day === 4) return addDays(key, 4);
  if (day === 5) return addDays(key, 3);
  return key;
}

export function nationalHolidays(year: number): Map<DateKey, string> {
  const y = String(year);
  const easter = easterSunday(year);
  const holidays = new Map<DateKey, string>([
    [`${y}-01-01`, "Año Nuevo"],
    [addDays(easter, -48), "Carnaval"],
    [addDays(easter, -47), "Carnaval"],
    [`${y}-03-24`, "Día de la Memoria"],
    [`${y}-04-02`, "Malvinas"],
    [addDays(easter, -2), "Viernes Santo"],
    [`${y}-05-01`, "Día del Trabajador"],
    [`${y}-05-25`, "Revolución de Mayo"],
    [movable(`${y}-06-17`), "Paso a la Inmortalidad de Güemes"],
    [`${y}-06-20`, "Día de la Bandera"],
    [`${y}-07-09`, "Día de la Independencia"],
    [movable(`${y}-08-17`), "Paso a la Inmortalidad de San Martín"],
    [movable(`${y}-10-12`), "Diversidad Cultural"],
    [movable(`${y}-11-20`), "Soberanía Nacional"],
    [`${y}-12-08`, "Inmaculada Concepción"],
    [`${y}-12-25`, "Navidad"],
  ]);
  return holidays;
}

export type HolidayCalendar = { extraHolidays: Set<DateKey> };

export function isBusinessDay(key: DateKey, calendar: HolidayCalendar) {
  const day = weekday(key);
  if (day === 0 || day === 6) return false;
  if (calendar.extraHolidays.has(key)) return false;
  return !nationalHolidays(Number(key.slice(0, 4))).has(key);
}

export function nextBusinessDay(key: DateKey, calendar: HolidayCalendar): DateKey {
  let current = key;
  for (let i = 0; i < 60; i += 1) {
    if (isBusinessDay(current, calendar)) return current;
    current = addDays(current, 1);
  }
  throw new Error("No se encontró un día hábil en los próximos 60 días.");
}

export function addBusinessDays(key: DateKey, days: number, calendar: HolidayCalendar): DateKey {
  let current = nextBusinessDay(key, calendar);
  for (let i = 0; i < days; i += 1) {
    current = nextBusinessDay(addDays(current, 1), calendar);
  }
  return current;
}

export type DispatchRules = {
  cutoffHour: number;
  cutoffMinute: number;
  preparationBusinessDays: number;
};

// Día en que sale un pedido confirmado en `confirmedAt`: el mismo día hábil si es antes del corte,
// si no el siguiente, más los días de preparación.
export function computeDispatchDate(confirmedAt: Date, rules: DispatchRules, calendar: HolidayCalendar): DateKey {
  const clock = argentinaClock(confirmedAt);
  const beforeCutoff = clock.hour < rules.cutoffHour || (clock.hour === rules.cutoffHour && clock.minute < rules.cutoffMinute);
  const base = isBusinessDay(clock.dateKey, calendar) && beforeCutoff ? clock.dateKey : nextBusinessDay(addDays(clock.dateKey, 1), calendar);
  return addBusinessDays(base, Math.max(0, rules.preparationBusinessDays), calendar);
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// "jueves 26/11"
export function formatDispatchDate(key: DateKey) {
  const [, m, d] = key.split("-");
  return `${WEEKDAYS[weekday(key)]} ${d}/${m}`;
}

export function dateKeyToDbDate(key: DateKey) {
  return keyToUtc(key);
}

export function dbDateToKey(date: Date): DateKey {
  return utcToKey(date);
}
