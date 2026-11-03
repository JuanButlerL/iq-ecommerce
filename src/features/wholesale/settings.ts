import { revalidatePath } from "next/cache";
import { cache } from "react";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { wholesaleSettingsSchema } from "@/lib/validations/wholesale-settings";

const WHOLESALE_SETTINGS_ID = "default";

// La fila la crea la migración; si faltara, se recrea con los valores por defecto del schema.
export const getWholesaleSettings = cache(async () => {
  const settings =
    (await prisma.wholesaleSettings.findUnique({ where: { id: WHOLESALE_SETTINGS_ID } })) ??
    (await prisma.wholesaleSettings.create({ data: { id: WHOLESALE_SETTINGS_ID } }));

  return { ...settings, bankTransferDiscountPercentage: Number(settings.bankTransferDiscountPercentage) };
});

export type WholesaleSettingsData = Awaited<ReturnType<typeof getWholesaleSettings>>;

export async function saveWholesaleSettings(payload: unknown) {
  const parsed = wholesaleSettingsSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Revisá las condiciones.", 400, true);
  }

  await prisma.wholesaleSettings.upsert({
    where: { id: WHOLESALE_SETTINGS_ID },
    create: { id: WHOLESALE_SETTINGS_ID, ...parsed.data },
    update: parsed.data,
  });

  revalidatePath("/mayoristas");
  revalidatePath("/admin/mayoristas/condiciones");
}

// Regla de envío del canal mayorista. Si no existe (base sin migrar), se crea vacía para poder cargarla.
export async function getWholesaleShippingRule() {
  const include = { provinces: { orderBy: { provinceName: "asc" as const } } };
  const existing = await prisma.shippingRule.findFirst({ where: { channel: "WHOLESALE" }, include, orderBy: { createdAt: "asc" } });

  if (existing) {
    return existing;
  }

  return prisma.shippingRule.create({
    data: { name: "Envíos mayoristas", mode: "PROVINCE", channel: "WHOLESALE", isDefault: false },
    include,
  });
}
