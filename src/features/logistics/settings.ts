import { prisma } from "@/lib/db/prisma";
import { dbDateToKey, toArgentinaDateKey, type HolidayCalendar } from "@/features/logistics/business-days";
import { getAndreaniConfig, getCorreoConfig } from "@/lib/integrations/logistics/config";
import { getCarrierAdapter } from "@/lib/integrations/logistics";

export async function getShippingSettings() {
  return prisma.shippingSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export type ShippingSettingsData = Awaited<ReturnType<typeof getShippingSettings>>;

// Feriados cargados en el admin desde hoy (los nacionales se calculan solos).
export async function getHolidayCalendar(): Promise<HolidayCalendar> {
  const today = toArgentinaDateKey(new Date());
  const rows = await prisma.shippingHoliday.findMany({
    where: { date: { gte: new Date(`${today}T00:00:00Z`) } },
    select: { date: true },
  });
  return { extraHolidays: new Set(rows.map((row) => dbDateToKey(row.date))) };
}

export async function getDefaultWarehouse() {
  return prisma.warehouse.findFirst({
    where: { active: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

// Qué transportistas se pueden usar ahora: prendidos en el admin y con credenciales.
export function carrierAvailability(settings: ShippingSettingsData) {
  return {
    ANDREANI: settings.andreaniEnabled && getCarrierAdapter("ANDREANI").isConfigured(),
    CORREO_AR: settings.correoEnabled && getCarrierAdapter("CORREO_AR").isConfigured(),
  };
}

// Estado de las credenciales para el admin, sin mostrar valores.
export function credentialStatus() {
  const a = getAndreaniConfig();
  const c = getCorreoConfig();
  return {
    andreani: {
      environment: a.environment,
      user: Boolean(a.user && a.password),
      clientNumber: Boolean(a.clientNumber),
      contractHome: Boolean(a.contractHome),
      contractBranch: Boolean(a.contractBranch),
    },
    correo: {
      environment: c.environment,
      user: Boolean(c.user && c.password),
      customerId: Boolean(c.customerId || (c.accountEmail && c.accountPassword)),
    },
  };
}
