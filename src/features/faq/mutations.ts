import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { faqContentSchema, faqFormSchema, faqVisibilitySchema } from "@/lib/validations/faq";

function revalidateFaq() {
  revalidatePath("/", "layout");
  revalidatePath("/preguntas-frecuentes");
  revalidatePath("/admin/preguntas-frecuentes");
}

export async function saveFaq(payload: unknown, id?: string) {
  const parsed = faqFormSchema.safeParse(payload);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Pregunta inválida.", 400, true);

  if (id) {
    await prisma.frequentlyAskedQuestion.update({ where: { id }, data: parsed.data });
  } else {
    await prisma.frequentlyAskedQuestion.create({ data: parsed.data });
  }
  await hideEmptyPublishedFaq();
  revalidateFaq();
}

export async function deleteFaq(id: string) {
  await prisma.frequentlyAskedQuestion.delete({ where: { id } });
  await hideEmptyPublishedFaq();
  revalidateFaq();
}

async function hideEmptyPublishedFaq() {
  const activeCount = await prisma.frequentlyAskedQuestion.count({ where: { active: true } });
  if (activeCount === 0) {
    await prisma.storeSettings.updateMany({ where: { id: "default", faqSectionEnabled: true }, data: { faqSectionEnabled: false } });
  }
}

export async function setFaqVisibility(payload: unknown) {
  const parsed = faqVisibilitySchema.safeParse(payload);
  if (!parsed.success) throw new AppError("Estado de publicación inválido.", 400, true);

  if (parsed.data.enabled) {
    const activeCount = await prisma.frequentlyAskedQuestion.count({ where: { active: true } });
    if (activeCount === 0) throw new AppError("Cargá y activá al menos una pregunta antes de publicar la sección.", 400, true);
  }

  const updated = await prisma.storeSettings.updateMany({
    where: { id: "default" },
    data: { faqSectionEnabled: parsed.data.enabled },
  });
  if (updated.count === 0) {
    throw new AppError("Falta inicializar la configuración general de la tienda en esta base de datos.", 409, true);
  }
  revalidateFaq();
}

export async function saveFaqContent(payload: unknown) {
  const parsed = faqContentSchema.safeParse(payload);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Textos inválidos.", 400, true);

  const updated = await prisma.storeSettings.updateMany({
    where: { id: "default" },
    data: {
      faqEyebrow: parsed.data.eyebrow,
      faqTitle: parsed.data.title,
      faqTitleAccent: parsed.data.titleAccent,
      faqDescription: parsed.data.description,
      faqSupportTitle: parsed.data.supportTitle,
      faqSupportText: parsed.data.supportText,
    },
  });
  if (updated.count === 0) {
    throw new AppError("Falta inicializar la configuración general de la tienda en esta base de datos.", 409, true);
  }
  revalidateFaq();
}
