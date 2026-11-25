import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
export { importPostalCodes, parsePostalCodesCsv } from "@/features/logistics/postal-codes";
import { addDays, nationalHolidays, toArgentinaDateKey, dbDateToKey } from "@/features/logistics/business-days";
import { credentialStatus, getShippingSettings } from "@/features/logistics/settings";
import { ALERT_AFTER_ATTEMPTS } from "@/features/logistics/shipments";

// ---------- Lectura para el admin ----------

export async function getLogisticsAdminData() {
  const today = toArgentinaDateKey(new Date());
  const [settings, zones, holidays, warehouses, postalCount, ownCount] = await Promise.all([
    getShippingSettings(),
    prisma.ownDeliveryZone.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { postalCodes: true } } } }),
    prisma.shippingHoliday.findMany({ where: { date: { gte: new Date(`${addDays(today, -30)}T00:00:00Z`) } }, orderBy: { date: "asc" } }),
    prisma.warehouse.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
    prisma.postalCode.count(),
    prisma.postalCode.count({ where: { ownZoneId: { not: null } } }),
  ]);
  const year = Number(today.slice(0, 4));
  const national = [...nationalHolidays(year), ...nationalHolidays(year + 1)]
    .filter(([date]) => date >= today)
    .slice(0, 12)
    .map(([date, name]) => ({ date, name }));

  return {
    settings,
    credentials: credentialStatus(),
    zones: zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      priceArs: zone.priceArs,
      wholesalePriceArs: zone.wholesalePriceArs,
      deliveryDaysMin: zone.deliveryDaysMin,
      deliveryDaysMax: zone.deliveryDaysMax,
      active: zone.active,
      sortOrder: zone.sortOrder,
      postalCodes: zone._count.postalCodes,
    })),
    holidays: holidays.map((holiday) => ({ id: holiday.id, date: dbDateToKey(holiday.date), name: holiday.name })),
    nationalHolidays: national,
    warehouses,
    postalCodes: { total: postalCount, own: ownCount },
  };
}

export type LogisticsAdminData = Awaited<ReturnType<typeof getLogisticsAdminData>>;

// ---------- Configuración ----------

const settingsSchema = z.object({
  enabled: z.boolean(),
  andreaniEnabled: z.boolean(),
  correoEnabled: z.boolean(),
  ownEnabled: z.boolean(),
  branchPickupEnabled: z.boolean(),
  cutoffHour: z.coerce.number().int().min(0).max(23),
  cutoffMinute: z.coerce.number().int().min(0).max(59),
  preparationBusinessDays: z.coerce.number().int().min(0).max(10),
  defaultUnitWeightGrams: z.coerce.number().int().min(1).max(30000),
  defaultUnitLengthCm: z.coerce.number().int().min(1).max(150),
  defaultUnitWidthCm: z.coerce.number().int().min(1).max(150),
  defaultUnitHeightCm: z.coerce.number().int().min(1).max(150),
  quoteCacheHours: z.coerce.number().int().min(1).max(168),
});

export async function saveShippingSettings(payload: unknown) {
  const data = settingsSchema.parse(payload);
  if (data.enabled) {
    const warehouse = await prisma.warehouse.count({ where: { active: true } });
    if ((data.andreaniEnabled || data.correoEnabled) && warehouse === 0) {
      throw new AppError("Cargá un depósito de origen antes de prender Andreani o Correo.", 400, true);
    }
  }
  await prisma.shippingSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

// ---------- Zonas propias ----------

const zoneSchema = z.object({
  name: z.string().trim().min(2).max(60),
  priceArs: z.coerce.number().int().min(0).max(10_000_000),
  wholesalePriceArs: z.union([z.coerce.number().int().min(0).max(10_000_000), z.literal(""), z.null()]).optional(),
  deliveryDaysMin: z.coerce.number().int().min(0).max(30),
  deliveryDaysMax: z.coerce.number().int().min(0).max(30),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

function zoneData(payload: unknown) {
  const data = zoneSchema.parse(payload);
  if (data.deliveryDaysMax < data.deliveryDaysMin) throw new AppError("Los días máximos no pueden ser menos que los mínimos.", 400, true);
  return { ...data, wholesalePriceArs: data.wholesalePriceArs === "" || data.wholesalePriceArs === undefined ? null : data.wholesalePriceArs };
}

export async function createZone(payload: unknown) {
  return prisma.ownDeliveryZone.create({ data: zoneData(payload) });
}

export async function updateZone(id: string, payload: unknown) {
  return prisma.ownDeliveryZone.update({ where: { id }, data: zoneData(payload) });
}

export async function deleteZone(id: string) {
  // Los CP de la zona quedan sin reparto propio (onDelete: SetNull).
  await prisma.ownDeliveryZone.delete({ where: { id } });
}

// ---------- Feriados ----------

const holidaySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), name: z.string().trim().min(2).max(80) });

export async function addHoliday(payload: unknown) {
  const data = holidaySchema.parse(payload);
  await prisma.shippingHoliday.upsert({
    where: { date: new Date(`${data.date}T00:00:00Z`) },
    update: { name: data.name },
    create: { date: new Date(`${data.date}T00:00:00Z`), name: data.name },
  });
}

export async function deleteHoliday(id: string) {
  await prisma.shippingHoliday.delete({ where: { id } });
}

// ---------- Depósitos ----------

const warehouseSchema = z.object({
  name: z.string().trim().min(2).max(80),
  contactName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(40),
  email: z.string().trim().email(),
  taxId: z.string().trim().max(20).optional().or(z.literal("")),
  street: z.string().trim().min(2).max(120),
  number: z.string().trim().min(1).max(20),
  floor: z.string().trim().max(40).optional().or(z.literal("")),
  locality: z.string().trim().min(2).max(120),
  province: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().regex(/^\d{4,8}$/, "El CP tiene que ser numérico."),
  isDefault: z.boolean().default(false),
  active: z.boolean().default(true),
});

export async function saveWarehouse(id: string | null, payload: unknown) {
  const data = warehouseSchema.parse(payload);
  const clean = { ...data, taxId: data.taxId || null, floor: data.floor || null };
  return prisma.$transaction(async (tx) => {
    const saved = id ? await tx.warehouse.update({ where: { id }, data: clean }) : await tx.warehouse.create({ data: clean });
    // Un solo depósito por defecto; si no hay ninguno, el que se guarda pasa a serlo.
    if (clean.isDefault) {
      await tx.warehouse.updateMany({ where: { id: { not: saved.id } }, data: { isDefault: false } });
    } else if ((await tx.warehouse.count({ where: { isDefault: true } })) === 0) {
      await tx.warehouse.update({ where: { id: saved.id }, data: { isDefault: true } });
    }
    return saved;
  });
}

// ---------- Códigos postales ----------

const searchSchema = z.object({
  query: z.string().trim().max(60).default(""),
  onlyOwn: z.boolean().default(false),
  zoneId: z.string().uuid().optional(),
});

export async function searchPostalCodes(payload: unknown) {
  const { query, onlyOwn, zoneId } = searchSchema.parse(payload);
  const digits = query.replace(/\D/g, "");
  return prisma.postalCode.findMany({
    where: {
      ...(onlyOwn ? { ownZoneId: { not: null } } : {}),
      ...(zoneId ? { ownZoneId: zoneId } : {}),
      ...(query
        ? digits.length === query.length
          ? { postalCode: { startsWith: digits } }
          : { OR: [{ locality: { contains: query, mode: "insensitive" } }, { province: { contains: query, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: [{ postalCode: "asc" }, { locality: "asc" }],
    take: 200,
    include: { ownZone: { select: { id: true, name: true } } },
  });
}

const assignSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500), zoneId: z.string().uuid().nullable() });

export async function assignPostalCodesZone(payload: unknown) {
  const { ids, zoneId } = assignSchema.parse(payload);
  const result = await prisma.postalCode.updateMany({ where: { id: { in: ids } }, data: { ownZoneId: zoneId } });
  return { updated: result.count };
}

// ---------- Envíos para revisar ----------

export async function getShipmentsAdminData() {
  const [attention, recent] = await Promise.all([
    prisma.shipment.findMany({
      where: { OR: [{ status: "NEEDS_REVIEW" }, { status: "ERROR", attempts: { gte: ALERT_AFTER_ATTEMPTS } }] },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { order: { select: { id: true, publicOrderNumber: true, customerFirstName: true, customerLastName: true, customerBusinessName: true, channel: true } } },
    }),
    prisma.shipment.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 14 * 24 * 3_600_000) }, status: { not: "WAITING_PAYMENT" } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { order: { select: { id: true, publicOrderNumber: true, customerFirstName: true, customerLastName: true, customerBusinessName: true, channel: true } } },
    }),
  ]);
  const map = (row: (typeof recent)[number]) => ({
    id: row.id,
    orderId: row.order.id,
    orderNumber: row.order.publicOrderNumber,
    customer: row.order.customerBusinessName || `${row.order.customerFirstName} ${row.order.customerLastName}`,
    channel: row.order.channel,
    carrier: row.carrier,
    deliveryType: row.deliveryType,
    status: row.status,
    trackingNumber: row.trackingNumber,
    hasLabel: Boolean(row.labelStoragePath),
    attempts: row.attempts,
    lastError: row.lastError,
    dispatchDate: row.dispatchDate ? dbDateToKey(row.dispatchDate) : null,
    nextAttemptAt: row.nextAttemptAt,
    createdAt: row.createdAt,
  });
  return { attention: attention.map(map), recent: recent.map(map) };
}

export async function getProofsPendingCount() {
  return prisma.order.count({ where: { orderStatus: "PROOF_UPLOADED" } });
}
