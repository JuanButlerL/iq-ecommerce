"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hashWholesalePassword } from "@/features/wholesale/access";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { wholesaleContentSchema } from "@/lib/validations/wholesale-page";

// La contraseña nunca viaja hasheada desde el navegador: el admin manda una nueva o pide quitarla,
// y si no manda nada se conserva la que ya estaba guardada.
const accessPasswordChangeSchema = z.object({
  newAccessPassword: z
    .string()
    .trim()
    .min(6, "La contraseña de la página debe tener al menos 6 caracteres.")
    .max(100, "La contraseña de la página puede tener hasta 100 caracteres.")
    .optional()
    .or(z.literal("")),
  removeAccessPassword: z.boolean().optional(),
});

export async function saveWholesaleContent(payload: unknown) {
  const parsed = wholesaleContentSchema.safeParse(payload);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // Los mensajes propios ya están en castellano; los genéricos de zod (campo faltante o de otro tipo) no.
    const message =
      issue && issue.code !== "invalid_type"
        ? issue.message
        : `Datos de la página mayorista incompletos${issue ? ` (${issue.path.join(".")})` : ""}.`;
    throw new AppError(message, 400, true);
  }

  const passwordChange = accessPasswordChangeSchema.safeParse(payload);

  if (!passwordChange.success) {
    throw new AppError(passwordChange.error.issues[0]?.message ?? "Contraseña inválida.", 400, true);
  }

  const current = await getWholesaleContent();
  const accessPasswordHash = passwordChange.data.newAccessPassword
    ? hashWholesalePassword(passwordChange.data.newAccessPassword)
    : passwordChange.data.removeAccessPassword
      ? ""
      : current.accessPasswordHash;
  const content = { ...parsed.data, accessPasswordHash };

  await prisma.wholesalePage.upsert({
    where: { id: "default" },
    create: { id: "default", content },
    update: { content },
  });

  revalidatePath("/mayoristas");
  revalidatePath("/admin/mayoristas", "layout");
}
