"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { storeSettingsSchema } from "@/lib/validations/settings";
import { AppError } from "@/lib/errors/app-error";

export async function updateStoreSettings(payload: unknown) {
  const parsed = storeSettingsSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Configuración inválida.", 400);
  }

  await prisma.storeSettings.update({
    where: { id: "default" },
    data: {
      ...parsed.data,
      activeShippingRuleId: parsed.data.activeShippingRuleId || null,
      instagramUrl: parsed.data.instagramUrl || null,
      checkoutMessage: parsed.data.checkoutMessage || null,
      transferInstructions: parsed.data.transferInstructions || null,
      mercadoPagoCheckoutLabel: parsed.data.mercadoPagoCheckoutLabel || null,
      institutionalBanner: parsed.data.institutionalBanner || null,
      purchaseSuccessMessage: parsed.data.purchaseSuccessMessage || null,
    },
  });

  revalidatePath("/");
  revalidatePath("/checkout");
  revalidatePath("/admin/configuracion");
}
