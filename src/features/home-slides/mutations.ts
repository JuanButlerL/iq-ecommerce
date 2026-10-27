"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  homeCarouselSettingsSchema,
  homeSlideFormSchema,
  homeSlideIdSchema,
  homeSlideReorderSchema,
} from "@/lib/validations/home-slide";

export async function saveHomeSlide(payload: unknown, slideId?: string) {
  const parsed = homeSlideFormSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Datos del slide inválidos.", 400, true);
  }

  const data = {
    eyebrow: parsed.data.eyebrow || null,
    title: parsed.data.title,
    mobileTitle: parsed.data.mobileTitle || null,
    subtitle: parsed.data.subtitle || null,
    badges: parsed.data.badges,
    ctaLabel: parsed.data.ctaLabel || null,
    ctaUrl: parsed.data.ctaUrl || null,
    imageUrl: parsed.data.imageUrl,
    mobileImageUrl: parsed.data.mobileImageUrl || null,
    imageAlt: parsed.data.imageAlt || null,
    active: parsed.data.active,
  };

  if (slideId) {
    const { count } = await prisma.homeSlide.updateMany({
      where: { id: assertHomeSlideId(slideId) },
      data,
    });

    if (count === 0) {
      throw new AppError("El slide no existe o ya fue eliminado.", 404, true);
    }
  } else {
    // New slides go to the end; the order is changed by dragging in the admin.
    const last = await prisma.homeSlide.aggregate({ _max: { sortOrder: true } });

    await prisma.homeSlide.create({
      data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    });
  }

  revalidateHomeSlideViews();
}

export async function deleteHomeSlide(slideId: string) {
  const { count } = await prisma.homeSlide.deleteMany({
    where: { id: assertHomeSlideId(slideId) },
  });

  if (count === 0) {
    throw new AppError("El slide no existe o ya fue eliminado.", 404, true);
  }

  revalidateHomeSlideViews();
}

export async function reorderHomeSlides(payload: unknown) {
  const parsed = homeSlideReorderSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Orden inválido.", 400, true);
  }

  const { slideIds } = parsed.data;

  if (new Set(slideIds).size !== slideIds.length) {
    throw new AppError("Orden inválido.", 400, true);
  }

  const existingCount = await prisma.homeSlide.count({ where: { id: { in: slideIds } } });
  const totalCount = await prisma.homeSlide.count();

  if (existingCount !== slideIds.length || totalCount !== slideIds.length) {
    throw new AppError("La lista de slides cambió. Recargá la página y volvé a ordenar.", 409, true);
  }

  await prisma.$transaction(
    slideIds.map((id, index) =>
      prisma.homeSlide.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );

  revalidateHomeSlideViews();
}

export async function saveHomeCarouselSettings(payload: unknown) {
  const parsed = homeCarouselSettingsSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Duración inválida.", 400, true);
  }

  const { count } = await prisma.storeSettings.updateMany({
    where: { id: "default" },
    data: { heroCarouselIntervalSeconds: parsed.data.intervalSeconds },
  });

  if (count === 0) {
    throw new AppError("Primero guardá la configuración general de la tienda.", 409, true);
  }

  revalidateHomeSlideViews();
}

function assertHomeSlideId(slideId: string) {
  if (!homeSlideIdSchema.safeParse(slideId).success) {
    throw new AppError("El slide no existe o ya fue eliminado.", 404, true);
  }

  return slideId;
}

function revalidateHomeSlideViews() {
  revalidatePath("/");
  revalidatePath("/admin/home-carrusel");
}
