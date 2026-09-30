import { NewsletterDeliveryStatus, NewsletterStatus, NewsletterSubscriberStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export const NEWSLETTER_PAGE_SIZE = 9;

export const newsletterPageDefaults = {
  eyebrow: "Newsletter IQ Kids",
  title: "Ideas simples para la semana",
  description: "Recetas, tips de nutrición y novedades para resolver la vianda y la merienda sin vueltas.",
};

// A scheduled newsletter that has not started sending stays off the web even if it
// is marked visible, so content is never published before its email goes out.
function publicWhere(now = new Date()): Prisma.NewsletterWhereInput {
  return {
    webVisible: true,
    archivedAt: null,
    publishedAt: { lte: now },
    NOT: { status: { in: [NewsletterStatus.SCHEDULED, NewsletterStatus.NEEDS_REVIEW] }, sendingStartedAt: null },
  };
}

const publicCardSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  excerpt: true,
  category: true,
  coverImageUrl: true,
  coverImageAlt: true,
  publishedAt: true,
} satisfies Prisma.NewsletterSelect;

export async function getNewsletterPageSettings() {
  const settings = await prisma.storeSettings.findUnique({
    where: { id: "default" },
    select: { newsletterSectionEnabled: true, newsletterEyebrow: true, newsletterTitle: true, newsletterDescription: true },
  });

  return {
    enabled: Boolean(settings?.newsletterSectionEnabled),
    eyebrow: settings?.newsletterEyebrow || newsletterPageDefaults.eyebrow,
    title: settings?.newsletterTitle || newsletterPageDefaults.title,
    description: settings?.newsletterDescription || newsletterPageDefaults.description,
  };
}

export async function getPublishedNewsletters(page = 1) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const where = publicWhere();
  const [items, total] = await Promise.all([
    prisma.newsletter.findMany({
      where,
      select: publicCardSelect,
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * NEWSLETTER_PAGE_SIZE,
      take: NEWSLETTER_PAGE_SIZE,
    }),
    prisma.newsletter.count({ where }),
  ]);

  return { items, total, page: safePage, pageCount: Math.max(1, Math.ceil(total / NEWSLETTER_PAGE_SIZE)) };
}

export async function getPublishedNewsletterBySlug(slug: string) {
  const newsletter = await prisma.newsletter.findFirst({ where: { ...publicWhere(), slug } });

  if (newsletter) {
    return { newsletter, redirectTo: null };
  }

  const renamed = await prisma.newsletter.findFirst({ where: { ...publicWhere(), previousSlugs: { has: slug } }, select: { slug: true } });

  return { newsletter: null, redirectTo: renamed?.slug ?? null };
}

export async function getNewsletterNeighbours(newsletter: { id: string; publishedAt: Date | null }) {
  const where = publicWhere();

  if (!newsletter.publishedAt) {
    return { newer: null, older: null, more: [] };
  }

  const [newer, older, more] = await Promise.all([
    prisma.newsletter.findFirst({
      where: { ...where, publishedAt: { gt: newsletter.publishedAt, lte: new Date() } },
      select: publicCardSelect,
      orderBy: { publishedAt: "asc" },
    }),
    prisma.newsletter.findFirst({
      where: { ...where, publishedAt: { lt: newsletter.publishedAt } },
      select: publicCardSelect,
      orderBy: { publishedAt: "desc" },
    }),
    prisma.newsletter.findMany({
      where: { AND: [where, { id: { not: newsletter.id } }] },
      select: publicCardSelect,
      orderBy: { publishedAt: "desc" },
      take: 3,
    }),
  ]);

  return { newer, older, more };
}

// Ready for app/sitemap.ts once it exists.
export async function getNewsletterSitemapEntries() {
  const settings = await getNewsletterPageSettings();

  if (!settings.enabled) {
    return [];
  }

  return prisma.newsletter.findMany({
    where: publicWhere(),
    select: { slug: true, updatedAt: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export type NewsletterDeliveryStats = {
  total: number;
  pending: number;
  reserved: number;
  sent: number;
  skipped: number;
  errors: number;
  opened: number;
  clicked: number;
};

const emptyStats = (): NewsletterDeliveryStats => ({ total: 0, pending: 0, reserved: 0, sent: 0, skipped: 0, errors: 0, opened: 0, clicked: 0 });

async function getDeliveryStats(newsletterIds: string[]) {
  const stats = new Map<string, NewsletterDeliveryStats>(newsletterIds.map((id) => [id, emptyStats()]));

  if (newsletterIds.length === 0) {
    return stats;
  }

  const [byStatus, opened, clicked] = await Promise.all([
    prisma.newsletterDelivery.groupBy({ by: ["newsletterId", "status"], where: { newsletterId: { in: newsletterIds } }, _count: { _all: true } }),
    prisma.newsletterDelivery.groupBy({ by: ["newsletterId"], where: { newsletterId: { in: newsletterIds }, firstOpenedAt: { not: null } }, _count: { _all: true } }),
    prisma.newsletterDelivery.groupBy({ by: ["newsletterId"], where: { newsletterId: { in: newsletterIds }, firstClickedAt: { not: null } }, _count: { _all: true } }),
  ]);
  const statusKey: Record<NewsletterDeliveryStatus, keyof NewsletterDeliveryStats> = {
    PENDING: "pending",
    RESERVED: "reserved",
    SENT: "sent",
    SKIPPED: "skipped",
    ERROR: "errors",
  };

  for (const row of byStatus) {
    const entry = stats.get(row.newsletterId) ?? emptyStats();
    entry[statusKey[row.status]] += row._count._all;
    entry.total += row._count._all;
    stats.set(row.newsletterId, entry);
  }

  for (const row of opened) stats.get(row.newsletterId)!.opened = row._count._all;
  for (const row of clicked) stats.get(row.newsletterId)!.clicked = row._count._all;

  return stats;
}

export async function getAdminNewsletters() {
  const newsletters = await prisma.newsletter.findMany({
    orderBy: [{ archivedAt: { sort: "desc", nulls: "first" } }, { updatedAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      coverImageUrl: true,
      coverImageAlt: true,
      status: true,
      webVisible: true,
      scheduledAt: true,
      sendingStartedAt: true,
      sentAt: true,
      publishedAt: true,
      reviewReason: true,
      archivedAt: true,
      updatedAt: true,
    },
  });
  const stats = await getDeliveryStats(newsletters.map((newsletter) => newsletter.id));

  return newsletters.map((newsletter) => ({ ...newsletter, stats: stats.get(newsletter.id) ?? emptyStats() }));
}

export async function getAdminNewsletter(id: string) {
  const newsletter = await prisma.newsletter.findUnique({
    where: { id },
    include: { auditEvents: { orderBy: { createdAt: "desc" }, take: 60 } },
  });

  if (!newsletter) {
    return null;
  }

  const stats = await getDeliveryStats([id]);

  return { ...newsletter, stats: stats.get(id) ?? emptyStats() };
}

export async function getAdminNewsletterDeliveries(id: string, status?: NewsletterDeliveryStatus | null) {
  return prisma.newsletterDelivery.findMany({
    where: { newsletterId: id, ...(status ? { status } : {}) },
    orderBy: [{ wave: "asc" }, { createdAt: "asc" }],
    take: 1000,
    select: {
      id: true,
      recipientEmail: true,
      wave: true,
      status: true,
      skipReason: true,
      errorMessage: true,
      providerMessageId: true,
      openCount: true,
      firstOpenedAt: true,
      clickCount: true,
      firstClickedAt: true,
      reservedAt: true,
      sentAt: true,
      createdAt: true,
    },
  });
}

export async function getNewsletterAudienceSummary() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [subscribed, unsubscribed, newLastMonth, unsubscribedLastMonth] = await Promise.all([
    prisma.newsletterSubscriber.count({ where: { status: NewsletterSubscriberStatus.SUBSCRIBED } }),
    prisma.newsletterSubscriber.count({ where: { status: NewsletterSubscriberStatus.UNSUBSCRIBED } }),
    prisma.newsletterSubscriber.count({ where: { status: NewsletterSubscriberStatus.SUBSCRIBED, consentedAt: { gte: since } } }),
    prisma.newsletterSubscriber.count({ where: { status: NewsletterSubscriberStatus.UNSUBSCRIBED, unsubscribedAt: { gte: since } } }),
  ]);

  return { subscribed, unsubscribed, newLastMonth, unsubscribedLastMonth };
}

export async function getNewsletterAdminSettings() {
  const settings = await prisma.storeSettings.findUnique({
    where: { id: "default" },
    select: {
      newsletterSectionEnabled: true,
      newsletterEyebrow: true,
      newsletterTitle: true,
      newsletterDescription: true,
      newsletterSenderName: true,
      newsletterFromEmail: true,
      newsletterReplyToEmail: true,
      newsletterTestRecipients: true,
      newsletterDailyLimit: true,
    },
  });

  return {
    sectionEnabled: Boolean(settings?.newsletterSectionEnabled),
    eyebrow: settings?.newsletterEyebrow ?? "",
    title: settings?.newsletterTitle ?? "",
    description: settings?.newsletterDescription ?? "",
    senderName: settings?.newsletterSenderName ?? "IQ Kids",
    fromEmail: settings?.newsletterFromEmail ?? "no-reply@iqkids.com.ar",
    replyToEmail: settings?.newsletterReplyToEmail ?? "",
    testRecipients: settings?.newsletterTestRecipients ?? [],
    dailyLimit: settings?.newsletterDailyLimit ?? 80,
  };
}
