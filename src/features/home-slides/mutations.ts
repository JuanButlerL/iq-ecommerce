"use server";

import { Prisma, type SalesChannel } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { argentinaLocalInputToIso } from "@/features/newsletter/components/newsletter-admin-labels";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import {
  homeCarouselSettingsSchema,
  homeSlideFormSchema,
  homeSlideIdSchema,
  homeSlideReorderSchema,
} from "@/lib/validations/home-slide";

export async function saveHomeSlide(payload: unknown, slideId?: string, channel: SalesChannel = "RETAIL") {
  const parsed = homeSlideFormSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Datos del slide inválidos.", 400, true);
  }

  const data = {
    eyebrow: parsed.data.eyebrow || null,
    title: parsed.data.title ?? "",
    mobileTitle: parsed.data.mobileTitle || null,
    subtitle: parsed.data.subtitle || null,
    badges: parsed.data.badges,
    ctaLabel: parsed.data.ctaLabel || null,
    ctaUrl: parsed.data.ctaUrl || null,
    imageUrl: parsed.data.imageUrl,
    mobileImageUrl: parsed.data.mobileImageUrl || null,
    imageAlt: parsed.data.imageAlt || null,
    imageOverlay: parsed.data.imageOverlay,
    fitImage: parsed.data.fitImage,
    // El botón del banner solo se guarda en modo banner.
    overlayButton: parsed.data.fitImage && parsed.data.overlayButton ? parsed.data.overlayButton : Prisma.DbNull,
    active: parsed.data.active,
    startsAt: parseArgentinaDateTime(parsed.data.startsAt),
    endsAt: parseArgentinaDateTime(parsed.data.endsAt),
  };

  if (slideId) {
    const { count } = await prisma.homeSlide.updateMany({
      where: { id: assertHomeSlideId(slideId), channel },
      data,
    });

    if (count === 0) {
      throw new AppError("El slide no existe o ya fue eliminado.", 404, true);
    }
  } else {
    // New slides go to the end; the order is changed by dragging in the admin.
    const last = await prisma.homeSlide.aggregate({ where: { channel }, _max: { sortOrder: true } });

    await prisma.homeSlide.create({
      data: { ...data, channel, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    });
  }

  revalidateHomeSlideViews(channel);
}

export async function deleteHomeSlide(slideId: string, channel: SalesChannel = "RETAIL") {
  const { count } = await prisma.homeSlide.deleteMany({
    where: { id: assertHomeSlideId(slideId), channel },
  });

  if (count === 0) {
    throw new AppError("El slide no existe o ya fue eliminado.", 404, true);
  }

  revalidateHomeSlideViews(channel);
}

export async function reorderHomeSlides(payload: unknown, channel: SalesChannel = "RETAIL") {
  const parsed = homeSlideReorderSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Orden inválido.", 400, true);
  }

  const { slideIds } = parsed.data;

  if (new Set(slideIds).size !== slideIds.length) {
    throw new AppError("Orden inválido.", 400, true);
  }

  const existingCount = await prisma.homeSlide.count({ where: { id: { in: slideIds }, channel } });
  const totalCount = await prisma.homeSlide.count({ where: { channel } });

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

  revalidateHomeSlideViews(channel);
}

export async function saveHomeCarouselSettings(payload: unknown, channel: SalesChannel = "RETAIL") {
  const parsed = homeCarouselSettingsSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Duración inválida.", 400, true);
  }

  if (channel === "WHOLESALE") {
    // La duración del carrusel mayorista vive en el contenido de la landing (hero.intervalSeconds), como antes.
    const current = await getWholesaleContent();
    const content = { ...current, hero: { ...current.hero, intervalSeconds: parsed.data.intervalSeconds } };

    await prisma.wholesalePage.upsert({
      where: { id: "default" },
      create: { id: "default", content },
      update: { content },
    });

    revalidateHomeSlideViews(channel);
    return;
  }

  const { count } = await prisma.storeSettings.updateMany({
    where: { id: "default" },
    data: { heroCarouselIntervalSeconds: parsed.data.intervalSeconds },
  });

  if (count === 0) {
    throw new AppError("Primero guardá la configuración general de la tienda.", 409, true);
  }

  revalidateHomeSlideViews(channel);
}

function parseArgentinaDateTime(value: string | undefined) {
  const iso = value ? argentinaLocalInputToIso(value) : null;
  return iso ? new Date(iso) : null;
}

function assertHomeSlideId(slideId: string) {
  if (!homeSlideIdSchema.safeParse(slideId).success) {
    throw new AppError("El slide no existe o ya fue eliminado.", 404, true);
  }

  return slideId;
}

function revalidateHomeSlideViews(channel: SalesChannel) {
  if (channel === "WHOLESALE") {
    revalidatePath("/mayoristas");
    revalidatePath("/admin/mayoristas", "layout");
    return;
  }

  revalidatePath("/");
  revalidatePath("/admin/home-carrusel");
}
