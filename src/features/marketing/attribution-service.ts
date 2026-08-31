import { MarketingEventType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { classifyMarketingAttribution, type MarketingSessionContextInput, marketingSessionContextSchema } from "@/lib/marketing/attribution";

export function parseMarketingSessionContext(payload: unknown): MarketingSessionContextInput | null {
  const parsed = marketingSessionContextSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export async function registerMarketingSession(payload: unknown) {
  const context = parseMarketingSessionContext(payload);

  if (!context) {
    return null;
  }

  const existing = await prisma.marketingSession.findUnique({
    where: { sessionKey: context.sessionKey },
    select: { id: true },
  });

  if (existing) {
    await prisma.marketingSession.update({
      where: { sessionKey: context.sessionKey },
      data: { lastSeenAt: new Date() },
    });

    return existing;
  }

  const attribution = classifyMarketingAttribution(context);

  return prisma.$transaction(async (tx) => {
    const session = await tx.marketingSession.create({
      data: {
        visitorId: context.visitorId,
        sessionKey: context.sessionKey,
        entryPath: context.pagePath,
        entryUrl: context.pageUrl,
        referrerUrl: context.referrer || null,
        referrerHost: attribution.referrerHost,
        sourceCategory: attribution.sourceCategory,
        sourcePlatform: attribution.sourcePlatform,
        sourceChannel: attribution.sourceChannel,
        sourceLabel: attribution.sourceLabel,
        isPaid: attribution.isPaid,
        utmSource: attribution.utmSource,
        utmMedium: attribution.utmMedium,
        utmCampaign: attribution.utmCampaign,
        utmContent: attribution.utmContent,
        utmTerm: attribution.utmTerm,
        gclid: attribution.gclid,
        fbclid: attribution.fbclid,
        ttclid: attribution.ttclid,
        msclkid: attribution.msclkid,
        landingQuery: attribution.landingQuery ?? undefined,
        lastSeenAt: new Date(),
      },
      select: { id: true },
    });

    await tx.marketingEvent.create({
      data: {
        marketingSessionId: session.id,
        eventType: MarketingEventType.SESSION_STARTED,
        path: context.pagePath,
        metadata: { pageUrl: context.pageUrl },
      },
    });

    return session;
  });
}

export async function ensureMarketingSession(payload: unknown, email?: string | null) {
  const context = parseMarketingSessionContext(payload);

  if (!context) {
    return null;
  }

  const attribution = classifyMarketingAttribution(context);
  const normalizedEmail = email?.trim().toLowerCase() || null;

  const session = await prisma.marketingSession.upsert({
    where: { sessionKey: context.sessionKey },
    update: {
      visitorId: context.visitorId,
      lastSeenAt: new Date(),
      email: normalizedEmail ?? undefined,
    },
    create: {
      visitorId: context.visitorId,
      sessionKey: context.sessionKey,
      entryPath: context.pagePath,
      entryUrl: context.pageUrl,
      referrerUrl: context.referrer || null,
      referrerHost: attribution.referrerHost,
      sourceCategory: attribution.sourceCategory,
      sourcePlatform: attribution.sourcePlatform,
      sourceChannel: attribution.sourceChannel,
      sourceLabel: attribution.sourceLabel,
      isPaid: attribution.isPaid,
      utmSource: attribution.utmSource,
      utmMedium: attribution.utmMedium,
      utmCampaign: attribution.utmCampaign,
      utmContent: attribution.utmContent,
      utmTerm: attribution.utmTerm,
      gclid: attribution.gclid,
      fbclid: attribution.fbclid,
      ttclid: attribution.ttclid,
      msclkid: attribution.msclkid,
      landingQuery: attribution.landingQuery ?? undefined,
      email: normalizedEmail,
      lastSeenAt: new Date(),
    },
    select: { id: true, sessionKey: true, visitorId: true },
  });

  if (normalizedEmail) {
    await prisma.marketingSession.updateMany({
      where: {
        visitorId: context.visitorId,
        email: null,
      },
      data: {
        email: normalizedEmail,
      },
    });
  }

  return session;
}

export async function logMarketingEvent(input: {
  marketingContext?: unknown;
  eventType: MarketingEventType;
  email?: string | null;
  path: string;
  orderId?: string | null;
  cartRecoveryLeadId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const session = await ensureMarketingSession(input.marketingContext, input.email ?? null);

  if (!session) {
    return null;
  }

  return prisma.marketingEvent.create({
    data: {
      marketingSessionId: session.id,
      eventType: input.eventType,
      path: input.path,
      email: input.email ?? null,
      orderId: input.orderId ?? null,
      cartRecoveryLeadId: input.cartRecoveryLeadId ?? null,
      metadata: input.metadata,
    },
    select: { id: true },
  });
}

export async function logOrderConfirmedFromStoredAttribution(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerEmail: true,
      publicOrderNumber: true,
      marketingSessionId: true,
    },
  });

  if (!order?.marketingSessionId) {
    return null;
  }

  const existing = await prisma.marketingEvent.findFirst({
    where: {
      orderId,
      eventType: MarketingEventType.ORDER_CONFIRMED,
    },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  return prisma.marketingEvent.create({
    data: {
      marketingSessionId: order.marketingSessionId,
      eventType: MarketingEventType.ORDER_CONFIRMED,
      path: `/checkout/confirmacion/${order.publicOrderNumber}`,
      email: order.customerEmail,
      orderId: order.id,
      metadata: { orderNumber: order.publicOrderNumber },
    },
    select: { id: true },
  });
}
