import { randomUUID } from "node:crypto";
import { EmailSendStatus, NewsletterDeliveryStatus, NewsletterStatus, NewsletterSubscriberStatus, Prisma } from "@prisma/client";

import { isEmailUnsubscribed } from "@/features/email/newsletter-service";
import { sendEmail } from "@/features/email/provider";
import { recordNewsletterAudit } from "@/features/newsletter/audit";
import { computeNewsletterContentHash } from "@/features/newsletter/content";
import { personalizeNewsletterEmail, type NewsletterEmailSnapshot } from "@/features/newsletter/render-email";
import { buildSnapshotForNewsletter, toNewsletterContent } from "@/features/newsletter/server-content";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";

// Safety model (see docs/email-automations.md, "Newsletter"):
// - Nothing is sent unless NEWSLETTER_SENDING_ENABLED, EMAIL_SENDING_ENABLED and a
//   provider are configured, AND the newsletter was explicitly approved in admin.
// - One delivery row per newsletter + email (unique index). Each row is reserved
//   with a conditional update before contacting the provider, so concurrent runs
//   can never send it twice.
// - No automatic retries: ERROR and stuck RESERVED rows wait for manual review.
//   A missed email is preferred over a duplicated one.
// - Late or grown audiences are parked in NEEDS_REVIEW instead of being sent.
// - Outside production only the admin test inboxes can receive real sends.

export const SEND_INTERVAL_MS = 550; // Resend allows ~2 requests per second.
export const AUDIENCE_GROWTH_FACTOR = 1.2;
export const AUDIENCE_GROWTH_MARGIN = 5;
// Circuit breaker: consecutive provider failures pause the newsletter instead of
// burning through the whole list with errors (e.g. quota or rate limit reached).
export const MAX_CONSECUTIVE_PROVIDER_ERRORS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type NewsletterQueueResult = {
  enabled: boolean;
  started: Array<{ newsletterId: string; wave: number; recipients: number }>;
  review: Array<{ newsletterId: string; reason: string }>;
  finished: string[];
  sent: number;
  skipped: number;
  errors: number;
  stoppedByDailyLimit: boolean;
};

type NewsletterSenderSettings = {
  newsletterSenderName: string;
  newsletterFromEmail: string;
  newsletterReplyToEmail: string | null;
  newsletterTestRecipients: string[];
  newsletterDailyLimit: number;
};

const senderSettingsSelect = {
  newsletterSenderName: true,
  newsletterFromEmail: true,
  newsletterReplyToEmail: true,
  newsletterTestRecipients: true,
  newsletterDailyLimit: true,
} as const;

export function maxAudienceForApproval(approvedRecipientCount: number) {
  return Math.ceil(approvedRecipientCount * AUDIENCE_GROWTH_FACTOR) + AUDIENCE_GROWTH_MARGIN;
}

export function eligibleSubscribersWhere(newsletterId: string) {
  return {
    status: NewsletterSubscriberStatus.SUBSCRIBED,
    deliveries: { none: { newsletterId } },
  } satisfies Prisma.NewsletterSubscriberWhereInput;
}

export async function countEligibleSubscribers(newsletterId: string) {
  return prisma.newsletterSubscriber.count({ where: eligibleSubscribersWhere(newsletterId) });
}

function siteUrl() {
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
}

function isValidSnapshot(value: unknown): value is NewsletterEmailSnapshot {
  const snapshot = value as NewsletterEmailSnapshot | null;
  return Boolean(
    snapshot &&
      snapshot.version === 1 &&
      typeof snapshot.subject === "string" &&
      typeof snapshot.html === "string" &&
      typeof snapshot.text === "string" &&
      Array.isArray(snapshot.links),
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSenderSettings(): Promise<NewsletterSenderSettings> {
  const settings = await prisma.storeSettings.findUnique({ where: { id: "default" }, select: senderSettingsSelect });

  return {
    newsletterSenderName: settings?.newsletterSenderName || "IQ Kids",
    newsletterFromEmail: settings?.newsletterFromEmail || env.EMAIL_FROM_DEFAULT,
    newsletterReplyToEmail: settings?.newsletterReplyToEmail ?? null,
    newsletterTestRecipients: (settings?.newsletterTestRecipients ?? []).map((email) => email.trim().toLowerCase()),
    newsletterDailyLimit: settings?.newsletterDailyLimit ?? 80,
  };
}

// ---------------------------------------------------------------------------
// Cron entry point
// ---------------------------------------------------------------------------

export async function processNewsletterQueue(options: { now?: Date } = {}): Promise<NewsletterQueueResult> {
  const result: NewsletterQueueResult = {
    enabled: env.newsletterSendingEnabled,
    started: [],
    review: [],
    finished: [],
    sent: 0,
    skipped: 0,
    errors: 0,
    stoppedByDailyLimit: false,
  };

  if (!env.newsletterSendingEnabled) {
    return result;
  }

  const now = options.now ?? new Date();
  const settings = await getSenderSettings();

  await startDueNewsletters(now, result);
  await sendPendingDeliveries(now, settings, result);

  return result;
}

async function moveToReview(newsletter: { id: string; scheduledAt: Date | null }, reason: string, result: NewsletterQueueResult, metadata: Prisma.InputJsonObject = {}) {
  const moved = await prisma.newsletter.updateMany({
    where: { id: newsletter.id, status: NewsletterStatus.SCHEDULED, scheduledAt: newsletter.scheduledAt },
    data: { status: NewsletterStatus.NEEDS_REVIEW, reviewReason: reason },
  });

  if (moved.count === 1) {
    await recordNewsletterAudit(prisma, { newsletterId: newsletter.id, action: "moved_to_review", metadata: { reason, ...metadata } });
    result.review.push({ newsletterId: newsletter.id, reason });
  }
}

async function startDueNewsletters(now: Date, result: NewsletterQueueResult) {
  const due = await prisma.newsletter.findMany({
    where: {
      status: NewsletterStatus.SCHEDULED,
      approvedAt: { not: null },
      scheduledAt: { lte: now },
      archivedAt: null,
    },
    orderBy: { scheduledAt: "asc" },
    take: 5,
  });

  for (const newsletter of due) {
    if (!newsletter.scheduledAt || !newsletter.approvedAt) {
      continue;
    }

    const lateMs = now.getTime() - newsletter.scheduledAt.getTime();

    if (lateMs > env.NEWSLETTER_LATE_MARGIN_HOURS * 60 * 60 * 1000) {
      await moveToReview(newsletter, "late", result, { lateMinutes: Math.round(lateMs / 60000) });
      continue;
    }

    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: eligibleSubscribersWhere(newsletter.id),
      select: { id: true, email: true },
      orderBy: { consentedAt: "asc" },
    });
    const approvedCount = newsletter.approvedRecipientCount ?? 0;

    if (subscribers.length === 0) {
      await moveToReview(newsletter, "no_recipients", result);
      continue;
    }

    if (subscribers.length > maxAudienceForApproval(approvedCount)) {
      await moveToReview(newsletter, "audience_grew", result, { approved: approvedCount, current: subscribers.length });
      continue;
    }

    const snapshot = isValidSnapshot(newsletter.emailSnapshot) ? newsletter.emailSnapshot : await buildSnapshotForNewsletter(newsletter);
    const wave = newsletter.currentWave + 1;

    const started = await prisma.$transaction(async (tx) => {
      // Only the process that flips SCHEDULED -> SENDING creates the deliveries.
      const claimed = await tx.newsletter.updateMany({
        where: {
          id: newsletter.id,
          status: NewsletterStatus.SCHEDULED,
          scheduledAt: newsletter.scheduledAt,
          approvedAt: newsletter.approvedAt,
        },
        data: {
          status: NewsletterStatus.SENDING,
          currentWave: wave,
          reviewReason: null,
          sendingStartedAt: newsletter.sendingStartedAt ?? now,
          contentLockedAt: newsletter.contentLockedAt ?? now,
          publishedAt: newsletter.publishedAt ?? now,
          emailSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });

      if (claimed.count !== 1) {
        return null;
      }

      // skipDuplicates + the unique index guarantee one row per email and newsletter.
      const created = await tx.newsletterDelivery.createMany({
        data: subscribers.map((subscriber) => ({
          newsletterId: newsletter.id,
          subscriberId: subscriber.id,
          recipientEmail: subscriber.email.trim().toLowerCase(),
          wave,
          status: NewsletterDeliveryStatus.PENDING,
          openToken: randomUUID(),
          clickToken: randomUUID(),
          unsubscribeToken: randomUUID(),
        })),
        skipDuplicates: true,
      });

      await recordNewsletterAudit(tx, {
        newsletterId: newsletter.id,
        action: "dispatch_started",
        metadata: { wave, recipients: created.count, approved: approvedCount },
      });

      return created.count;
    });

    if (started !== null) {
      result.started.push({ newsletterId: newsletter.id, wave, recipients: started });
    }
  }
}

async function getDailyUsage(now: Date) {
  const since = new Date(now.getTime() - DAY_MS);
  const [newsletterSends, automationSends] = await Promise.all([
    prisma.newsletterDelivery.count({
      where: {
        OR: [
          { status: NewsletterDeliveryStatus.SENT, sentAt: { gte: since } },
          { status: NewsletterDeliveryStatus.RESERVED, reservedAt: { gte: since } },
        ],
      },
    }),
    prisma.emailSendLog.count({ where: { status: EmailSendStatus.SENT, sentAt: { gte: since } } }),
  ]);

  // Automations share the provider quota, so they count against the daily limit.
  return newsletterSends + automationSends;
}

async function finishIfDone(newsletterId: string, now: Date, result: NewsletterQueueResult) {
  const pending = await prisma.newsletterDelivery.count({ where: { newsletterId, status: NewsletterDeliveryStatus.PENDING } });

  if (pending > 0) {
    return false;
  }

  const finished = await prisma.newsletter.updateMany({
    where: { id: newsletterId, status: NewsletterStatus.SENDING },
    data: { status: NewsletterStatus.SENT, sentAt: now },
  });

  if (finished.count === 1) {
    await recordNewsletterAudit(prisma, { newsletterId, action: "dispatch_finished" });
    result.finished.push(newsletterId);
  }

  return true;
}

async function skipDelivery(id: string, reason: string, result: NewsletterQueueResult) {
  const skipped = await prisma.newsletterDelivery.updateMany({
    where: { id, status: NewsletterDeliveryStatus.PENDING },
    data: { status: NewsletterDeliveryStatus.SKIPPED, skipReason: reason },
  });

  result.skipped += skipped.count;
}

async function sendPendingDeliveries(now: Date, settings: NewsletterSenderSettings, result: NewsletterQueueResult) {
  const sending = await prisma.newsletter.findMany({
    where: { status: NewsletterStatus.SENDING },
    orderBy: { sendingStartedAt: "asc" },
  });

  if (sending.length === 0) {
    return;
  }

  let budget = Math.min(env.NEWSLETTER_BATCH_SIZE, settings.newsletterDailyLimit - (await getDailyUsage(now)));

  for (const newsletter of sending) {
    if (await finishIfDone(newsletter.id, now, result)) {
      continue;
    }

    if (budget <= 0) {
      result.stoppedByDailyLimit = true;
      continue;
    }

    if (!isValidSnapshot(newsletter.emailSnapshot)) {
      const parked = await prisma.newsletter.updateMany({
        where: { id: newsletter.id, status: NewsletterStatus.SENDING },
        data: { status: NewsletterStatus.PAUSED, reviewReason: "invalid_snapshot" },
      });
      if (parked.count === 1) {
        await recordNewsletterAudit(prisma, { newsletterId: newsletter.id, action: "paused", metadata: { reason: "invalid_snapshot" } });
      }
      continue;
    }

    const snapshot = newsletter.emailSnapshot;
    let consecutiveErrors = 0;
    const deliveries = await prisma.newsletterDelivery.findMany({
      where: { newsletterId: newsletter.id, status: NewsletterDeliveryStatus.PENDING },
      orderBy: { createdAt: "asc" },
      take: budget,
    });

    for (const delivery of deliveries) {
      // Emergency pause from admin takes effect before the next email.
      const current = await prisma.newsletter.findUnique({ where: { id: newsletter.id }, select: { status: true } });

      if (current?.status !== NewsletterStatus.SENDING) {
        break;
      }

      if (await isEmailUnsubscribed(prisma, delivery.recipientEmail)) {
        await skipDelivery(delivery.id, "unsubscribed", result);
        continue;
      }

      if (!env.isProduction && !settings.newsletterTestRecipients.includes(delivery.recipientEmail)) {
        await skipDelivery(delivery.id, "non_production", result);
        continue;
      }

      const reserved = await prisma.newsletterDelivery.updateMany({
        where: { id: delivery.id, status: NewsletterDeliveryStatus.PENDING },
        data: { status: NewsletterDeliveryStatus.RESERVED, reservedAt: new Date() },
      });

      if (reserved.count !== 1) {
        continue;
      }

      budget -= 1;
      const unsubscribeUrl = `${siteUrl()}/api/newsletter/unsubscribe/${delivery.unsubscribeToken}`;
      const email = personalizeNewsletterEmail(snapshot, {
        linkUrl: (index) => `${siteUrl()}/api/newsletter/click/${delivery.clickToken}?l=${index}`,
        unsubscribeUrl,
        openPixelUrl: `${siteUrl()}/api/newsletter/open/${delivery.openToken}`,
      });
      let providerAccepted = false;

      try {
        const sent = await sendEmail({
          fromEmail: settings.newsletterFromEmail,
          senderName: settings.newsletterSenderName,
          replyToEmail: settings.newsletterReplyToEmail,
          to: delivery.recipientEmail,
          subject: snapshot.subject,
          html: email.html,
          text: email.text,
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        providerAccepted = true;

        await prisma.newsletterDelivery.update({
          where: { id: delivery.id },
          data: { status: NewsletterDeliveryStatus.SENT, sentAt: new Date(), providerMessageId: sent.providerMessageId, errorMessage: null },
        });
        result.sent += 1;
        consecutiveErrors = 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido";

        if (providerAccepted) {
          // Accepted by the provider but not recorded: stays RESERVED for manual reconciliation.
          console.error(`[newsletter] delivery ${delivery.id} accepted but not recorded: ${message}`);
          result.errors += 1;
        } else {
          await prisma.newsletterDelivery.update({
            where: { id: delivery.id },
            data: { status: NewsletterDeliveryStatus.ERROR, errorMessage: message.slice(0, 500) },
          });
          result.errors += 1;
        }

        consecutiveErrors += 1;

        if (consecutiveErrors >= MAX_CONSECUTIVE_PROVIDER_ERRORS) {
          const paused = await prisma.newsletter.updateMany({
            where: { id: newsletter.id, status: NewsletterStatus.SENDING },
            data: { status: NewsletterStatus.PAUSED, reviewReason: "provider_errors" },
          });
          if (paused.count === 1) {
            await recordNewsletterAudit(prisma, { newsletterId: newsletter.id, action: "paused", metadata: { reason: "provider_errors", lastError: message.slice(0, 300) } });
          }
          break;
        }
      }

      if (budget <= 0) {
        break;
      }

      await sleep(SEND_INTERVAL_MS);
    }

    await finishIfDone(newsletter.id, now, result);
  }
}

// ---------------------------------------------------------------------------
// Test sends: only to the admin test inboxes, never create delivery rows.
// ---------------------------------------------------------------------------

export async function sendNewsletterTest(newsletterId: string, actorEmail: string | null) {
  if (!env.canSendEmail) {
    throw new AppError("El envío de emails está desactivado en el servidor. No se puede mandar la prueba.", 400, true);
  }

  const [newsletter, settings] = await Promise.all([prisma.newsletter.findUnique({ where: { id: newsletterId } }), getSenderSettings()]);

  if (!newsletter || newsletter.archivedAt) {
    throw new AppError("No encontramos la newsletter.", 404, true);
  }

  if (settings.newsletterTestRecipients.length === 0) {
    throw new AppError("Configurá al menos una casilla de prueba en Newsletter > Configuración.", 400, true);
  }

  const snapshot = await buildSnapshotForNewsletter(newsletter);
  const email = personalizeNewsletterEmail(snapshot, {
    linkUrl: (_index, url) => url,
    unsubscribeUrl: `${siteUrl()}/newsletter`,
    openPixelUrl: null,
  });
  const failures: string[] = [];

  for (const recipient of settings.newsletterTestRecipients) {
    try {
      await sendEmail({
        fromEmail: settings.newsletterFromEmail,
        senderName: settings.newsletterSenderName,
        replyToEmail: settings.newsletterReplyToEmail,
        to: recipient,
        subject: `[PRUEBA] ${snapshot.subject}`,
        html: email.html,
        text: email.text,
      });
    } catch (error) {
      failures.push(`${recipient}: ${error instanceof Error ? error.message : "error"}`);
    }
  }

  if (failures.length === settings.newsletterTestRecipients.length) {
    throw new AppError(`No se pudo enviar la prueba. ${failures[0] ?? ""}`.trim(), 502, true);
  }

  // Only the exact content that was tested unlocks scheduling. The hash is
  // recomputed from what is stored (canonical form), and the write only happens
  // if nobody saved changes after this test started.
  const testedHash = computeNewsletterContentHash(toNewsletterContent(newsletter));
  await prisma.newsletter.updateMany({
    where: { id: newsletterId, updatedAt: newsletter.updatedAt },
    data: { lastTestSentAt: new Date(), lastTestContentHash: testedHash, contentHash: testedHash },
  });
  await recordNewsletterAudit(prisma, {
    newsletterId,
    action: "test_sent",
    actorEmail,
    metadata: { recipients: settings.newsletterTestRecipients, failures },
  });

  return { recipients: settings.newsletterTestRecipients, failures };
}
