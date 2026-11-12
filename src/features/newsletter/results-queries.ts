import { NewsletterDeliveryStatus, OrderStatus, PaymentStatus, type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  buildNewsletterResults,
  newsletterCampaigns,
  normalizeEmail,
  type NewsletterResults,
  type ResultsDelivery,
  type ResultsNewsletter,
  type ResultsOrder,
  type ResultsVisit,
} from "@/features/newsletter/results";

const confirmedOrderWhere: Prisma.OrderWhereInput = {
  paymentStatus: { in: [PaymentStatus.PAID, PaymentStatus.PROOF_UPLOADED] },
  orderStatus: { notIn: [OrderStatus.CANCELLED, OrderStatus.EXPIRED] },
};

const orderSelect = {
  id: true,
  publicOrderNumber: true,
  customerEmail: true,
  customerFirstName: true,
  customerLastName: true,
  createdAt: true,
  totalArs: true,
  discountArs: true,
  couponCode: true,
  marketingSessionId: true,
  marketingVisitorId: true,
} satisfies Prisma.OrderSelect;

const newsletterSelect = {
  id: true,
  slug: true,
  previousSlugs: true,
  title: true,
  emailSubject: true,
  sendingStartedAt: true,
  sentAt: true,
} satisfies Prisma.NewsletterSelect;

type NewsletterRecord = Prisma.NewsletterGetPayload<{ select: typeof newsletterSelect }>;

function toResultsNewsletter(record: NewsletterRecord): ResultsNewsletter | null {
  const startedAt = record.sendingStartedAt ?? record.sentAt;
  if (!startedAt) return null;
  return { id: record.id, slug: record.slug, previousSlugs: record.previousSlugs, title: record.title, emailSubject: record.emailSubject, startedAt };
}

async function loadDeliveries(newsletterIds: string[]) {
  const rows = await prisma.newsletterDelivery.findMany({
    where: { newsletterId: { in: newsletterIds }, status: NewsletterDeliveryStatus.SENT },
    select: {
      newsletterId: true,
      recipientEmail: true,
      sentAt: true,
      openCount: true,
      firstOpenedAt: true,
      clickCount: true,
      firstClickedAt: true,
      subscriber: { select: { unsubscribedAt: true } },
    },
  });
  const byNewsletter = new Map<string, ResultsDelivery[]>();
  for (const row of rows) {
    const list = byNewsletter.get(row.newsletterId) ?? [];
    list.push({
      recipientEmail: row.recipientEmail,
      sentAt: row.sentAt,
      openCount: row.openCount,
      firstOpenedAt: row.firstOpenedAt,
      clickCount: row.clickCount,
      firstClickedAt: row.firstClickedAt,
      unsubscribedAt: row.subscriber?.unsubscribedAt ?? null,
    });
    byNewsletter.set(row.newsletterId, list);
  }
  return byNewsletter;
}

async function loadVisits(campaigns: string[], since: Date) {
  if (campaigns.length === 0) return [];
  return prisma.marketingSession.findMany({
    where: {
      firstSeenAt: { gte: since },
      OR: campaigns.map((campaign) => ({ utmCampaign: { equals: campaign, mode: "insensitive" as const } })),
    },
    select: { id: true, visitorId: true, email: true, firstSeenAt: true, utmCampaign: true },
  });
}

async function loadOrders(since: Date): Promise<ResultsOrder[]> {
  const rows = await prisma.order.findMany({ where: { ...confirmedOrderWhere, createdAt: { gte: since } }, select: orderSelect, orderBy: { createdAt: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    publicOrderNumber: row.publicOrderNumber,
    customerEmail: row.customerEmail,
    customerName: `${row.customerFirstName} ${row.customerLastName}`.trim(),
    createdAt: row.createdAt,
    totalArs: row.totalArs,
    discountArs: row.discountArs,
    couponCode: row.couponCode,
    marketingSessionId: row.marketingSessionId,
    marketingVisitorId: row.marketingVisitorId,
  }));
}

async function loadPurchaseHistory(orders: ResultsOrder[]) {
  const emails = [...new Set(orders.flatMap((order) => [order.customerEmail, normalizeEmail(order.customerEmail)]))];
  const history = new Map<string, Date[]>();
  if (emails.length === 0) return history;
  const rows = await prisma.order.findMany({ where: { ...confirmedOrderWhere, customerEmail: { in: emails } }, select: { customerEmail: true, createdAt: true } });
  for (const row of rows) {
    const email = normalizeEmail(row.customerEmail);
    history.set(email, [...(history.get(email) ?? []), row.createdAt]);
  }
  return history;
}

async function computeResults(records: NewsletterRecord[]): Promise<NewsletterResults[]> {
  const newsletters = records.map(toResultsNewsletter).filter((item): item is ResultsNewsletter => item !== null);
  if (newsletters.length === 0) return [];

  const since = new Date(Math.min(...newsletters.map((item) => item.startedAt.getTime())));
  const campaigns = [...new Set(newsletters.flatMap(newsletterCampaigns))];
  const [deliveries, visits, orders] = await Promise.all([loadDeliveries(newsletters.map((item) => item.id)), loadVisits(campaigns, since), loadOrders(since)]);
  const history = await loadPurchaseHistory(orders);

  return newsletters.map((newsletter) => {
    const own = new Set(newsletterCampaigns(newsletter));
    const ownVisits: ResultsVisit[] = visits
      .filter((visit) => visit.utmCampaign && own.has(visit.utmCampaign.trim().toLowerCase()) && visit.firstSeenAt.getTime() >= newsletter.startedAt.getTime())
      .map(({ id, visitorId, email, firstSeenAt }) => ({ id, visitorId, email, firstSeenAt }));

    return buildNewsletterResults({
      newsletter,
      deliveries: deliveries.get(newsletter.id) ?? [],
      orders,
      visits: ownVisits,
      previousPurchaseDates: history,
    });
  });
}

export async function getNewsletterResults(id: string) {
  const record = await prisma.newsletter.findUnique({ where: { id }, select: newsletterSelect });
  if (!record) return { found: false as const };
  // Empty when the newsletter was never sent.
  const results = (await computeResults([record]))[0] as NewsletterResults | undefined;
  return { found: true as const, title: record.title, results: results ?? null };
}

export async function getNewsletterResultsOverview(range: { from: Date; to: Date }) {
  const records = await prisma.newsletter.findMany({
    where: {
      OR: [
        { sendingStartedAt: { gte: range.from, lte: range.to } },
        { sendingStartedAt: null, sentAt: { gte: range.from, lte: range.to } },
      ],
    },
    select: newsletterSelect,
    orderBy: { sendingStartedAt: "asc" },
  });
  const results = await computeResults(records);
  const uniqueOrders = new Map<string, number>();

  // Orders can be credited to more than one newsletter (the person clicked both),
  // so the total counts each purchase once.
  for (const item of results) {
    for (const person of item.people) {
      for (const order of person.orders) {
        if (order.via.includes("open")) continue;
        uniqueOrders.set(order.orderNumber, order.totalArs);
      }
    }
  }

  const totals = {
    newsletters: results.length,
    sent: results.reduce((sum, item) => sum + item.summary.sent, 0),
    opened: results.reduce((sum, item) => sum + item.summary.opened, 0),
    clicked: results.reduce((sum, item) => sum + item.summary.clicked, 0),
    visits: results.reduce((sum, item) => sum + item.summary.visits, 0),
    uniqueOrders: uniqueOrders.size,
    uniqueRevenueArs: [...uniqueOrders.values()].reduce((sum, value) => sum + value, 0),
    unsubscribed: results.reduce((sum, item) => sum + item.summary.unsubscribed, 0),
  };

  return { results, totals };
}
