import { NewsletterDeliveryStatus, NewsletterStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordNewsletterAudit } from "@/features/newsletter/audit";
import { computeNewsletterContentHash, getNewsletterChecklist, slugifyNewsletter, type NewsletterContent } from "@/features/newsletter/content";
import { countEligibleSubscribers } from "@/features/newsletter/send-service";
import { toNewsletterContent } from "@/features/newsletter/server-content";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import {
  newsletterConfirmSchema,
  newsletterFormSchema,
  newsletterImportSchema,
  newsletterInternalNotesSchema,
  newsletterReconcileSchema,
  newsletterScheduleSchema,
  newsletterSettingsSchema,
  newsletterVisibilitySchema,
} from "@/lib/validations/newsletter";

const MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;
const SCHEDULE_PAST_TOLERANCE_MS = 5 * 60 * 1000;

function parseOrThrow<S extends z.ZodTypeAny>(schema: S, payload: unknown, fallback: string): z.infer<S> {
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? fallback, 400, true);
  }

  return parsed.data;
}

function revalidateNewsletter(slugs: string[] = []) {
  revalidatePath("/", "layout");
  revalidatePath("/newsletter");
  slugs.forEach((slug) => revalidatePath(`/newsletter/${slug}`));
  revalidatePath("/admin/newsletter");
}

async function getNewsletterOrThrow(id: string) {
  const newsletter = await prisma.newsletter.findUnique({ where: { id } });

  if (!newsletter) {
    throw new AppError("No encontramos la newsletter.", 404, true);
  }

  return newsletter;
}

function conflict() {
  return new AppError("La newsletter cambió mientras la editabas. Recargá la página y volvé a intentar.", 409, true);
}

function requireSendingEnabled() {
  if (!env.newsletterSendingEnabled) {
    throw new AppError(
      "El envío de newsletters está desactivado en el servidor (NEWSLETTER_SENDING_ENABLED). Podés preparar, previsualizar y mandar pruebas, pero no programar envíos reales.",
      400,
      true,
    );
  }
}

async function ensureSlugAvailable(slug: string, excludeId?: string) {
  const taken = await prisma.newsletter.findFirst({
    where: {
      OR: [{ slug }, { previousSlugs: { has: slug } }],
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  if (taken) {
    throw new AppError("Ya existe otra newsletter con esa URL. Elegí otra.", 409, true);
  }
}

async function uniqueSlug(base: string) {
  const root = slugifyNewsletter(base) || "newsletter";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? root : `${root}-${attempt + 1}`;
    const taken = await prisma.newsletter.findFirst({ where: { OR: [{ slug: candidate }, { previousSlugs: { has: candidate } }] }, select: { id: true } });

    if (!taken) {
      return candidate;
    }
  }

  return `${root}-${Date.now().toString(36)}`;
}

function parseScheduledAt(input: { sendNow?: boolean; scheduledAt?: string }, now: Date) {
  if (input.sendNow) {
    return now;
  }

  const scheduledAt = new Date(input.scheduledAt ?? "");

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new AppError("Elegí una fecha y hora válidas.", 400, true);
  }

  if (scheduledAt.getTime() < now.getTime() - SCHEDULE_PAST_TOLERANCE_MS) {
    throw new AppError("La fecha de envío ya pasó. Elegí una fecha futura o \"Enviar ahora\".", 400, true);
  }

  if (scheduledAt.getTime() > now.getTime() + MAX_SCHEDULE_AHEAD_MS) {
    throw new AppError("Se puede programar hasta 90 días hacia adelante.", 400, true);
  }

  return scheduledAt < now ? now : scheduledAt;
}

async function getTestRecipientsCount() {
  const settings = await prisma.storeSettings.findUnique({ where: { id: "default" }, select: { newsletterTestRecipients: true } });
  return settings?.newsletterTestRecipients.length ?? 0;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export async function createNewsletter(actorEmail: string | null) {
  const title = "Nueva newsletter";
  const slug = await uniqueSlug(`${title} ${new Date().toISOString().slice(0, 10)}`);
  const content: NewsletterContent = { slug, title, subtitle: null, excerpt: "", category: null, headerTag: null, coverImageUrl: null, coverImageAlt: null, blocks: [], emailSubject: title, emailPreviewText: null };
  const newsletter = await prisma.newsletter.create({
    data: {
      ...content,
      blocks: [],
      contentHash: computeNewsletterContentHash(content),
      createdBy: actorEmail,
      updatedBy: actorEmail,
    },
  });

  await recordNewsletterAudit(prisma, { newsletterId: newsletter.id, action: "created", actorEmail });
  revalidatePath("/admin/newsletter");

  return newsletter;
}

export async function saveNewsletter(id: string, payload: unknown, actorEmail: string | null, expectedUpdatedAt?: string | null, internalNotesPayload?: unknown) {
  const data = parseOrThrow(newsletterFormSchema, payload, "Revisá los datos de la newsletter.");
  const internalNotes = parseOrThrow(newsletterInternalNotesSchema, internalNotesPayload, "Revisá las notas internas.");
  const current = await getNewsletterOrThrow(id);

  // Another tab or admin saved in the meantime: never overwrite their changes silently.
  if (expectedUpdatedAt && expectedUpdatedAt !== current.updatedAt.toISOString()) {
    throw conflict();
  }

  if (current.archivedAt) {
    throw new AppError("La newsletter está archivada.", 400, true);
  }

  const emailAlreadySent = current.sendingStartedAt !== null;

  if (emailAlreadySent && (data.emailSubject !== current.emailSubject || (data.emailPreviewText ?? null) !== (current.emailPreviewText ?? null))) {
    throw new AppError("El asunto y la vista previa del mail ya no se pueden cambiar: la newsletter ya se envió. Podés seguir editando la versión web.", 400, true);
  }

  const productIds = [...new Set(data.blocks.flatMap((block) => (block.type === "product" ? [block.productId] : [])))];
  if (productIds.length > 0) {
    const found = await prisma.product.count({ where: { id: { in: productIds } } });
    if (found !== productIds.length) {
      throw new AppError("Uno de los productos destacados ya no existe. Elegí otro.", 400, true);
    }
  }

  const slugChanged = data.slug !== current.slug;
  if (slugChanged) {
    await ensureSlugAvailable(data.slug, id);
  }

  const contentHash = computeNewsletterContentHash(data);
  const contentChanged = contentHash !== current.contentHash;
  // A pending first send is cancelled when its content changes: it needs a new test and approval.
  const cancelsPendingFirstSend =
    contentChanged && !emailAlreadySent && (current.status === NewsletterStatus.SCHEDULED || current.status === NewsletterStatus.NEEDS_REVIEW);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.newsletter.updateMany({
      where: { id, updatedAt: current.updatedAt },
      data: {
        slug: data.slug,
        previousSlugs: slugChanged && current.publishedAt ? { push: current.slug } : undefined,
        title: data.title,
        subtitle: data.subtitle,
        excerpt: data.excerpt,
        category: data.category,
        headerTag: data.headerTag,
        internalNotes,
        coverImageUrl: data.coverImageUrl,
        coverImageAlt: data.coverImageAlt,
        blocks: data.blocks as unknown as Prisma.InputJsonValue,
        emailSubject: data.emailSubject,
        emailPreviewText: data.emailPreviewText,
        contentHash,
        updatedBy: actorEmail,
        ...(cancelsPendingFirstSend
          ? { status: NewsletterStatus.DRAFT, scheduledAt: null, approvedAt: null, approvedBy: null, approvedRecipientCount: null, reviewReason: null }
          : {}),
      },
    });

    if (result.count !== 1) {
      throw conflict();
    }

    if (contentChanged || internalNotes !== current.internalNotes) {
      await recordNewsletterAudit(tx, { newsletterId: id, action: "updated", actorEmail, metadata: { slugChanged } });
    }

    if (cancelsPendingFirstSend) {
      await recordNewsletterAudit(tx, { newsletterId: id, action: "schedule_cancelled", actorEmail, metadata: { reason: "content_edited" } });
    }

    return tx.newsletter.findUniqueOrThrow({ where: { id } });
  });

  revalidateNewsletter([current.slug, data.slug]);

  return { newsletter: updated, scheduleCancelled: cancelsPendingFirstSend };
}

export async function duplicateNewsletter(id: string, actorEmail: string | null) {
  const source = await getNewsletterOrThrow(id);
  const title = `Copia de ${source.title}`.slice(0, 140);
  const slug = await uniqueSlug(title);
  const content: NewsletterContent = { ...toNewsletterContent(source), slug, title };
  const copy = await prisma.newsletter.create({
    data: {
      slug,
      title,
      subtitle: source.subtitle,
      excerpt: source.excerpt,
      category: source.category,
      headerTag: source.headerTag,
      internalNotes: source.internalNotes,
      coverImageUrl: source.coverImageUrl,
      coverImageAlt: source.coverImageAlt,
      blocks: source.blocks as Prisma.InputJsonValue,
      emailSubject: source.emailSubject,
      emailPreviewText: source.emailPreviewText,
      contentHash: computeNewsletterContentHash(content),
      createdBy: actorEmail,
      updatedBy: actorEmail,
    },
  });

  await recordNewsletterAudit(prisma, { newsletterId: copy.id, action: "duplicated", actorEmail, metadata: { sourceId: source.id } });
  revalidatePath("/admin/newsletter");

  return copy;
}

// Creates DRAFTS only. Each item is validated like a normal save; invalid items are
// reported and skipped, never partially saved. Nothing is scheduled or published.
export async function importNewsletters(payload: unknown, actorEmail: string | null) {
  const { items } = parseOrThrow(newsletterImportSchema, payload, "El archivo no tiene un formato válido.");
  const created: Array<{ id: string; title: string }> = [];
  const failed: Array<{ index: number; title: string; error: string }> = [];

  for (const [index, item] of items.entries()) {
    const raw = (item.content ?? {}) as Record<string, unknown>;
    const title = typeof raw.title === "string" ? raw.title : `Newsletter ${index + 1}`;

    try {
      const slug = await uniqueSlug(title);
      const data = parseOrThrow(newsletterFormSchema, { ...raw, slug }, "Revisá el contenido importado.");
      const internalNotes = parseOrThrow(newsletterInternalNotesSchema, item.internalNotes, "Notas internas inválidas.");
      const newsletter = await prisma.newsletter.create({
        data: {
          ...data,
          blocks: data.blocks as unknown as Prisma.InputJsonValue,
          internalNotes,
          contentHash: computeNewsletterContentHash(data),
          createdBy: actorEmail,
          updatedBy: actorEmail,
        },
      });

      await recordNewsletterAudit(prisma, { newsletterId: newsletter.id, action: "created", actorEmail, metadata: { imported: true } });
      created.push({ id: newsletter.id, title: newsletter.title });
    } catch (error) {
      failed.push({ index, title, error: error instanceof AppError ? error.message : "Error inesperado al importar." });
    }
  }

  revalidatePath("/admin/newsletter");

  return { created, failed };
}

// Never-sent drafts are deleted; anything that was ever sent is archived (deliveries are kept).
export async function removeNewsletter(id: string, actorEmail: string | null) {
  const newsletter = await getNewsletterOrThrow(id);

  if (newsletter.status === NewsletterStatus.SCHEDULED || newsletter.status === NewsletterStatus.SENDING || newsletter.status === NewsletterStatus.PAUSED || newsletter.status === NewsletterStatus.NEEDS_REVIEW) {
    throw new AppError("Primero cancelá o terminá el envío de esta newsletter.", 400, true);
  }

  const deliveries = await prisma.newsletterDelivery.count({ where: { newsletterId: id } });

  if (newsletter.status === NewsletterStatus.DRAFT && newsletter.sendingStartedAt === null && deliveries === 0) {
    const deleted = await prisma.newsletter.deleteMany({ where: { id, status: NewsletterStatus.DRAFT, sendingStartedAt: null } });
    if (deleted.count !== 1) throw conflict();
    revalidateNewsletter([newsletter.slug]);
    return { deleted: true };
  }

  await prisma.newsletter.update({ where: { id }, data: { archivedAt: new Date(), webVisible: false, updatedBy: actorEmail } });
  await recordNewsletterAudit(prisma, { newsletterId: id, action: "archived", actorEmail });
  revalidateNewsletter([newsletter.slug]);

  return { deleted: false };
}

export async function setNewsletterVisibility(id: string, payload: unknown, actorEmail: string | null) {
  const { webVisible } = parseOrThrow(newsletterVisibilitySchema, payload, "Visibilidad inválida.");
  const newsletter = await getNewsletterOrThrow(id);

  if (newsletter.archivedAt) {
    throw new AppError("La newsletter está archivada.", 400, true);
  }

  if (webVisible && newsletter.excerpt.trim().length < 10) {
    throw new AppError("Completá el título y el resumen antes de mostrarla en la web.", 400, true);
  }

  await prisma.newsletter.update({
    where: { id },
    data: {
      webVisible,
      publishedAt: webVisible ? newsletter.publishedAt ?? newsletter.sendingStartedAt ?? new Date() : newsletter.publishedAt,
      updatedBy: actorEmail,
    },
  });
  await recordNewsletterAudit(prisma, { newsletterId: id, action: "visibility_changed", actorEmail, metadata: { webVisible } });
  revalidateNewsletter([newsletter.slug]);
}

// ---------------------------------------------------------------------------
// Sending lifecycle
// ---------------------------------------------------------------------------

export async function scheduleNewsletter(id: string, payload: unknown, actorEmail: string | null) {
  requireSendingEnabled();
  const schedule = parseOrThrow(newsletterScheduleSchema, payload, "Revisá la programación.");
  const now = new Date();
  const scheduledAt = parseScheduledAt(schedule, now);
  const newsletter = await getNewsletterOrThrow(id);

  if (newsletter.archivedAt || newsletter.status !== NewsletterStatus.DRAFT || newsletter.sendingStartedAt) {
    throw new AppError("Solo se puede programar una newsletter en borrador que todavía no se envió.", 400, true);
  }

  const content = toNewsletterContent(newsletter);
  parseOrThrow(newsletterFormSchema, content, "El contenido de la newsletter tiene errores. Guardala de nuevo antes de programar.");
  const checklist = getNewsletterChecklist(content, {
    contentHash: newsletter.contentHash,
    lastTestContentHash: newsletter.lastTestContentHash,
    testRecipientsCount: await getTestRecipientsCount(),
  });
  const missing = checklist.filter((item) => !item.ok && !item.optional);

  if (missing.length > 0) {
    throw new AppError(`Antes de programar: ${missing.map((item) => item.label.toLowerCase()).join(", ")}.`, 400, true);
  }

  const recipients = await countEligibleSubscribers(id);

  if (recipients === 0) {
    throw new AppError("No hay suscriptos activos para enviar.", 400, true);
  }

  const updated = await prisma.newsletter.updateMany({
    where: { id, status: NewsletterStatus.DRAFT, sendingStartedAt: null, contentHash: newsletter.contentHash },
    data: {
      status: NewsletterStatus.SCHEDULED,
      scheduledAt,
      approvedAt: now,
      approvedBy: actorEmail,
      approvedRecipientCount: recipients,
      reviewReason: null,
      updatedBy: actorEmail,
    },
  });

  if (updated.count !== 1) {
    throw conflict();
  }

  await recordNewsletterAudit(prisma, { newsletterId: id, action: "scheduled", actorEmail, metadata: { scheduledAt: scheduledAt.toISOString(), recipients } });
  revalidatePath("/admin/newsletter");

  return { scheduledAt, recipients };
}

export async function scheduleComplementarySend(id: string, payload: unknown, actorEmail: string | null) {
  requireSendingEnabled();
  const schedule = parseOrThrow(newsletterScheduleSchema, payload, "Revisá la programación.");
  const now = new Date();
  const scheduledAt = parseScheduledAt(schedule, now);
  const newsletter = await getNewsletterOrThrow(id);

  if (newsletter.archivedAt || newsletter.status !== NewsletterStatus.SENT || !newsletter.sendingStartedAt) {
    throw new AppError("El envío a nuevos suscriptos solo está disponible cuando la newsletter ya terminó de enviarse.", 400, true);
  }

  const recipients = await countEligibleSubscribers(id);

  if (recipients === 0) {
    throw new AppError("Todos los suscriptos ya la recibieron.", 400, true);
  }

  const updated = await prisma.newsletter.updateMany({
    where: { id, status: NewsletterStatus.SENT },
    data: {
      status: NewsletterStatus.SCHEDULED,
      scheduledAt,
      approvedAt: now,
      approvedBy: actorEmail,
      approvedRecipientCount: recipients,
      reviewReason: null,
      updatedBy: actorEmail,
    },
  });

  if (updated.count !== 1) {
    throw conflict();
  }

  await recordNewsletterAudit(prisma, {
    newsletterId: id,
    action: "complementary_scheduled",
    actorEmail,
    metadata: { scheduledAt: scheduledAt.toISOString(), recipients, wave: newsletter.currentWave + 1 },
  });
  revalidatePath("/admin/newsletter");

  return { scheduledAt, recipients };
}

export async function cancelNewsletterSchedule(id: string, actorEmail: string | null) {
  const newsletter = await getNewsletterOrThrow(id);

  if (newsletter.status !== NewsletterStatus.SCHEDULED && newsletter.status !== NewsletterStatus.NEEDS_REVIEW) {
    throw new AppError("No hay un envío programado para cancelar.", 400, true);
  }

  const updated = await prisma.newsletter.updateMany({
    where: { id, status: newsletter.status },
    data: {
      status: newsletter.sendingStartedAt ? NewsletterStatus.SENT : NewsletterStatus.DRAFT,
      scheduledAt: newsletter.sendingStartedAt ? newsletter.scheduledAt : null,
      approvedAt: null,
      approvedBy: null,
      approvedRecipientCount: null,
      reviewReason: null,
      updatedBy: actorEmail,
    },
  });

  if (updated.count !== 1) {
    throw conflict();
  }

  await recordNewsletterAudit(prisma, { newsletterId: id, action: "schedule_cancelled", actorEmail, metadata: { from: newsletter.status } });
  revalidatePath("/admin/newsletter");
}

// NEEDS_REVIEW -> send now, re-approving the current audience.
export async function approveNewsletterReview(id: string, payload: unknown, actorEmail: string | null) {
  requireSendingEnabled();
  parseOrThrow(newsletterConfirmSchema, payload, "Confirmación inválida.");
  const newsletter = await getNewsletterOrThrow(id);

  if (newsletter.status !== NewsletterStatus.NEEDS_REVIEW) {
    throw new AppError("La newsletter no está en revisión.", 400, true);
  }

  if (!newsletter.sendingStartedAt && newsletter.lastTestContentHash !== newsletter.contentHash) {
    throw new AppError("El contenido cambió desde la última prueba. Mandá una prueba nueva antes de enviar.", 400, true);
  }

  const recipients = await countEligibleSubscribers(id);

  if (recipients === 0) {
    throw new AppError("No hay suscriptos pendientes para esta newsletter.", 400, true);
  }

  const now = new Date();
  const updated = await prisma.newsletter.updateMany({
    where: { id, status: NewsletterStatus.NEEDS_REVIEW },
    data: {
      status: NewsletterStatus.SCHEDULED,
      scheduledAt: now,
      approvedAt: now,
      approvedBy: actorEmail,
      approvedRecipientCount: recipients,
      reviewReason: null,
      updatedBy: actorEmail,
    },
  });

  if (updated.count !== 1) {
    throw conflict();
  }

  await recordNewsletterAudit(prisma, { newsletterId: id, action: "scheduled", actorEmail, metadata: { fromReview: newsletter.reviewReason, recipients } });
  revalidatePath("/admin/newsletter");

  return { recipients };
}

export async function pauseNewsletter(id: string, actorEmail: string | null) {
  const updated = await prisma.newsletter.updateMany({
    where: { id, status: NewsletterStatus.SENDING },
    data: { status: NewsletterStatus.PAUSED, updatedBy: actorEmail },
  });

  if (updated.count !== 1) {
    throw new AppError("La newsletter no se está enviando.", 400, true);
  }

  await recordNewsletterAudit(prisma, { newsletterId: id, action: "paused", actorEmail });
  revalidatePath("/admin/newsletter");
}

export async function resumeNewsletter(id: string, payload: unknown, actorEmail: string | null) {
  parseOrThrow(newsletterConfirmSchema, payload, "Confirmación inválida.");
  const newsletter = await getNewsletterOrThrow(id);

  if (newsletter.reviewReason === "invalid_snapshot") {
    throw new AppError("Esta newsletter no se puede reanudar automáticamente. Revisá la auditoría.", 400, true);
  }

  const updated = await prisma.newsletter.updateMany({
    where: { id, status: NewsletterStatus.PAUSED },
    data: { status: NewsletterStatus.SENDING, reviewReason: null, updatedBy: actorEmail },
  });

  if (updated.count !== 1) {
    throw new AppError("La newsletter no está pausada.", 400, true);
  }

  await recordNewsletterAudit(prisma, { newsletterId: id, action: "resumed", actorEmail });
  revalidatePath("/admin/newsletter");
}

export async function cancelRemainingDeliveries(id: string, payload: unknown, actorEmail: string | null) {
  parseOrThrow(newsletterConfirmSchema, payload, "Confirmación inválida.");

  const skipped = await prisma.$transaction(async (tx) => {
    const updated = await tx.newsletter.updateMany({
      where: { id, status: NewsletterStatus.PAUSED },
      data: { status: NewsletterStatus.SENT, sentAt: new Date(), updatedBy: actorEmail },
    });

    if (updated.count !== 1) {
      throw new AppError("Solo se puede cancelar el resto de un envío pausado.", 400, true);
    }

    const result = await tx.newsletterDelivery.updateMany({
      where: { newsletterId: id, status: NewsletterDeliveryStatus.PENDING },
      data: { status: NewsletterDeliveryStatus.SKIPPED, skipReason: "cancelled_by_admin" },
    });

    await recordNewsletterAudit(tx, { newsletterId: id, action: "remaining_cancelled", actorEmail, metadata: { skipped: result.count } });

    return result.count;
  });

  revalidatePath("/admin/newsletter");

  return { skipped };
}

// Explicit bulk retry of ERROR rows (e.g. after the provider quota recovered).
// RESERVED rows are never included: they may already have been delivered.
export async function retryFailedDeliveries(id: string, payload: unknown, actorEmail: string | null) {
  requireSendingEnabled();
  parseOrThrow(newsletterConfirmSchema, payload, "Confirmación inválida.");

  const retried = await prisma.$transaction(async (tx) => {
    const newsletter = await tx.newsletter.findUnique({ where: { id }, select: { status: true } });

    if (!newsletter || (newsletter.status !== NewsletterStatus.SENT && newsletter.status !== NewsletterStatus.PAUSED && newsletter.status !== NewsletterStatus.SENDING)) {
      throw new AppError("Esta newsletter no tiene un envío para reintentar.", 400, true);
    }

    const result = await tx.newsletterDelivery.updateMany({
      where: { newsletterId: id, status: NewsletterDeliveryStatus.ERROR },
      data: { status: NewsletterDeliveryStatus.PENDING, errorMessage: null },
    });

    if (result.count === 0) {
      throw new AppError("No hay envíos con error para reintentar.", 400, true);
    }

    // A finished newsletter goes back to SENDING; a paused one stays paused until resumed.
    await tx.newsletter.updateMany({ where: { id, status: NewsletterStatus.SENT }, data: { status: NewsletterStatus.SENDING } });
    await recordNewsletterAudit(tx, { newsletterId: id, action: "delivery_reconciled", actorEmail, metadata: { bulkRetry: result.count } });

    return result.count;
  });

  revalidatePath("/admin/newsletter");

  return { retried };
}

// Manual reconciliation. RESERVED: confirm against the provider dashboard.
// ERROR: explicit single retry, never automatic.
export async function reconcileNewsletterDelivery(deliveryId: string, payload: unknown, actorEmail: string | null) {
  const { outcome } = parseOrThrow(newsletterReconcileSchema, payload, "Revisá la acción.");
  const delivery = await prisma.newsletterDelivery.findUnique({ where: { id: deliveryId }, include: { newsletter: { select: { id: true, status: true } } } });

  if (!delivery) {
    throw new AppError("No encontramos el envío.", 404, true);
  }

  const from = delivery.status;
  let changed = 0;

  if (from === NewsletterDeliveryStatus.RESERVED && (outcome === "sent" || outcome === "error")) {
    changed = (
      await prisma.newsletterDelivery.updateMany({
        where: { id: deliveryId, status: NewsletterDeliveryStatus.RESERVED },
        data:
          outcome === "sent"
            ? { status: NewsletterDeliveryStatus.SENT, sentAt: delivery.reservedAt ?? new Date(), errorMessage: null }
            : { status: NewsletterDeliveryStatus.ERROR, errorMessage: "Marcado como no enviado en la conciliación manual." },
      })
    ).count;
  } else if (from === NewsletterDeliveryStatus.ERROR && outcome === "retry") {
    requireSendingEnabled();
    changed = await prisma.$transaction(async (tx) => {
      const retried = await tx.newsletterDelivery.updateMany({
        where: { id: deliveryId, status: NewsletterDeliveryStatus.ERROR },
        data: { status: NewsletterDeliveryStatus.PENDING, errorMessage: null },
      });
      // A finished newsletter goes back to SENDING so the next run picks the retry up.
      await tx.newsletter.updateMany({
        where: { id: delivery.newsletterId, status: NewsletterStatus.SENT },
        data: { status: NewsletterStatus.SENDING },
      });
      return retried.count;
    });
  } else {
    throw new AppError("Esa acción no aplica al estado actual del envío.", 400, true);
  }

  if (changed !== 1) {
    throw conflict();
  }

  await recordNewsletterAudit(prisma, {
    newsletterId: delivery.newsletterId,
    action: "delivery_reconciled",
    actorEmail,
    metadata: { deliveryId, recipient: delivery.recipientEmail, from, outcome },
  });
  revalidatePath("/admin/newsletter");
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function saveNewsletterSettings(payload: unknown) {
  const data = parseOrThrow(newsletterSettingsSchema, payload, "Revisá la configuración.");

  if (data.sectionEnabled) {
    const published = await prisma.newsletter.count({ where: { webVisible: true, archivedAt: null } });
    if (published === 0) {
      throw new AppError("Mostrá al menos una newsletter en la web antes de activar la sección.", 400, true);
    }
  }

  const updated = await prisma.storeSettings.updateMany({
    where: { id: "default" },
    data: {
      newsletterSectionEnabled: data.sectionEnabled,
      newsletterEyebrow: data.eyebrow,
      newsletterTitle: data.title,
      newsletterDescription: data.description,
      newsletterSenderName: data.senderName,
      newsletterFromEmail: data.fromEmail,
      newsletterReplyToEmail: data.replyToEmail,
      newsletterTestRecipients: data.testRecipients,
      newsletterDailyLimit: data.dailyLimit,
    },
  });

  if (updated.count !== 1) {
    throw new AppError("No se encontró la configuración de la tienda.", 500, true);
  }

  revalidateNewsletter();
}
