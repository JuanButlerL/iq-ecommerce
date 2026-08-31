import { MarketingEventType, MarketingSourceCategory, MarketingSourcePlatform, OrderStatus, PaymentStatus } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { parseArgentinaDateParam } from "@/lib/utils/datetime";

const confirmedPaymentStatuses = new Set<PaymentStatus>([PaymentStatus.PAID, PaymentStatus.PROOF_UPLOADED]);
const cancelledOrderStatuses = new Set<OrderStatus>([OrderStatus.CANCELLED, OrderStatus.EXPIRED]);

type JourneySnapshot = {
  firstTouch: SessionRecord | null;
  lastTouch: SessionRecord | null;
  firstPaidTouch: SessionRecord | null;
  lastPaidTouch: SessionRecord | null;
  assistedSources: string[];
  assistedPlatforms: string[];
  assistedCampaigns: string[];
  touchpoints: number;
  journeySummary: string;
};

export type MarketingDashboardFilterValues = {
  dateFrom?: string;
  dateTo?: string;
  sourceCategory?: string;
  sourcePlatform?: string;
  search?: string;
  onlyRepeat?: string;
};

export type MarketingDashboardFilters = {
  dateFrom?: Date;
  dateTo?: Date;
  sourceCategory: MarketingSourceCategory | "ALL";
  sourcePlatform: MarketingSourcePlatform | "ALL";
  search: string;
  onlyRepeat: boolean;
};

type SessionRecord = {
  id: string;
  email: string | null;
  visitorId: string;
  sessionKey: string;
  entryPath: string;
  entryUrl: string | null;
  sourceCategory: MarketingSourceCategory;
  sourcePlatform: MarketingSourcePlatform;
  sourceChannel: string;
  sourceLabel: string;
  utmCampaign: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrerHost: string | null;
  isPaid: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

type LeadRecord = {
  id: string;
  email: string;
  status: string;
  subtotalArs: number;
  createdAt: Date;
  updatedAt: Date;
  checkoutStartedAt: Date | null;
  convertedAt: Date | null;
  convertedOrderNumber: string | null;
  marketingSession: SessionRecord | null;
};

type OrderRecord = {
  id: string;
  publicOrderNumber: string;
  customerEmail: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  totalArs: number;
  subtotalArs: number;
  shippingArs: number;
  paymentMethod: string;
  createdAt: Date;
  paidAt: Date | null;
  marketingSession: SessionRecord | null;
};

type EventRecord = {
  id: string;
  eventType: MarketingEventType;
  path: string;
  email: string | null;
  occurredAt: Date;
  marketingSession: SessionRecord | null;
  order: { id: string; publicOrderNumber: string; totalArs: number; paymentStatus: PaymentStatus } | null;
  cartRecoveryLead: { id: string; status: string; subtotalArs: number } | null;
};

export type MarketingDashboardData = {
  filters: MarketingDashboardFilters;
  summary: {
    sessions: number;
    emailsCaptured: number;
    ordersCreated: number;
    confirmedOrders: number;
    confirmedRevenue: number;
    uniqueCustomers: number;
    repeatCustomers: number;
    repeatCustomerRate: number;
    repeatRevenue: number;
  };
  categoryPerformance: Array<{
    key: string;
    label: string;
    sessions: number;
    popupLeads: number;
    cartLeads: number;
    ordersCreated: number;
    confirmedOrders: number;
    confirmedRevenue: number;
    repeatOrders: number;
  }>;
  campaignPerformance: Array<{
    key: string;
    category: string;
    platform: string;
    campaign: string;
    confirmedOrders: number;
    confirmedRevenue: number;
    leadsCaptured: number;
  }>;
  contacts: Array<{
    email: string;
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
    firstTouch: SessionRecord | null;
    lastTouch: SessionRecord | null;
    firstPaidTouch: SessionRecord | null;
    lastPaidTouch: SessionRecord | null;
    popupCapturedAt: Date | null;
    cartCapturedAt: Date | null;
    firstOrderAt: Date | null;
    lastOrderAt: Date | null;
    confirmedOrders: number;
    totalRevenue: number;
    repeatCustomer: boolean;
    lastOrderNumber: string | null;
    assistedSources: string[];
    assistedPlatforms: string[];
    assistedCampaigns: string[];
    touchpoints: number;
    journeySummary: string;
    timeline: Array<{
      type: string;
      occurredAt: Date;
      path: string;
      detail: string;
    }>;
  }>;
  recentOrders: Array<{
    orderNumber: string;
    email: string;
    createdAt: Date;
    paidAt: Date | null;
    totalArs: number;
    paymentStatus: PaymentStatus;
    repeatCustomer: boolean;
    sourceLabel: string;
    campaign: string | null;
    firstTouchLabel: string;
    firstCampaign: string | null;
    lastTouchLabel: string;
    lastCampaign: string | null;
    assistedCampaigns: string;
    assistedPlatforms: string;
    touchpoints: number;
    journeySummary: string;
  }>;
};

export function parseMarketingDashboardFilters(values: MarketingDashboardFilterValues | URLSearchParams | undefined): MarketingDashboardFilters {
  const read = (key: string) => values instanceof URLSearchParams ? values.get(key) ?? undefined : values?.[key as keyof MarketingDashboardFilterValues];
  const category = read("sourceCategory");
  const platform = read("sourcePlatform");

  return {
    dateFrom: parseArgentinaDateParam(read("dateFrom") ?? null),
    dateTo: parseArgentinaDateParam(read("dateTo") ?? null, true),
    sourceCategory: Object.values(MarketingSourceCategory).includes(category as MarketingSourceCategory) ? (category as MarketingSourceCategory) : "ALL",
    sourcePlatform: Object.values(MarketingSourcePlatform).includes(platform as MarketingSourcePlatform) ? (platform as MarketingSourcePlatform) : "ALL",
    search: (read("search") ?? "").trim().toLowerCase(),
    onlyRepeat: read("onlyRepeat") === "1",
  };
}

export async function getMarketingDashboardData(filters: MarketingDashboardFilters): Promise<MarketingDashboardData> {
  const [sessions, leads, orders, events] = await Promise.all([
    prisma.marketingSession.findMany({
      orderBy: { firstSeenAt: "desc" },
      select: sessionSelect,
    }),
    prisma.cartRecoveryLead.findMany({
      orderBy: { createdAt: "desc" },
      select: leadSelect,
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      select: orderSelect,
    }),
    prisma.marketingEvent.findMany({
      orderBy: { occurredAt: "desc" },
      select: eventSelect,
    }),
  ]);

  const confirmedOrdersAll = orders.filter(isConfirmedOrder);
  const confirmedOrdersByEmail = groupByEmail(confirmedOrdersAll);
  const sessionsByEmail = groupSessionsByEmail(sessions);

  const filteredSessions = sessions.filter((session) => matchesSessionFilter(session, filters));
  const filteredLeads = leads.filter((lead) => matchesScopedRecordFilter(lead.createdAt, lead.email, lead.marketingSession, filters));
  const filteredOrders = orders.filter((order) => matchesOrderFilter(order, filters));
  const filteredEvents = events.filter((event) => matchesEventFilter(event, filters));
  const filteredConfirmedOrders = filteredOrders.filter(isConfirmedOrder);

  const categoryMap = new Map<string, MarketingDashboardData["categoryPerformance"][number]>();

  for (const session of filteredSessions) {
    const key = `${session.sourceCategory}:${session.sourcePlatform}`;
    const current = categoryMap.get(key) ?? emptyCategoryRow(key, `${session.sourceCategory} · ${session.sourcePlatform}`);
    current.sessions += 1;
    categoryMap.set(key, current);
  }

  for (const event of filteredEvents) {
    const session = event.marketingSession;
    if (!session) continue;
    const key = `${session.sourceCategory}:${session.sourcePlatform}`;
    const current = categoryMap.get(key) ?? emptyCategoryRow(key, `${session.sourceCategory} · ${session.sourcePlatform}`);
    if (event.eventType === MarketingEventType.POPUP_CAPTURED) current.popupLeads += 1;
    if (event.eventType === MarketingEventType.CART_CAPTURED) current.cartLeads += 1;
    if (event.eventType === MarketingEventType.ORDER_CREATED) current.ordersCreated += 1;
    categoryMap.set(key, current);
  }

  for (const order of filteredConfirmedOrders) {
    const touchSnapshot = getOrderJourneySnapshot(order, sessionsByEmail);
    const anchorSession = order.marketingSession ?? touchSnapshot.lastTouch ?? touchSnapshot.firstTouch;
    if (!anchorSession) continue;
    const key = `${anchorSession.sourceCategory}:${anchorSession.sourcePlatform}`;
    const current = categoryMap.get(key) ?? emptyCategoryRow(key, `${anchorSession.sourceCategory} · ${anchorSession.sourcePlatform}`);
    current.confirmedOrders += 1;
    current.confirmedRevenue += order.totalArs;
    if ((confirmedOrdersByEmail.get(normalizeEmail(order.customerEmail))?.length ?? 0) > 1) {
      current.repeatOrders += 1;
    }
    categoryMap.set(key, current);
  }

  const campaignMap = new Map<string, MarketingDashboardData["campaignPerformance"][number]>();
  for (const order of filteredConfirmedOrders) {
    const touchSnapshot = getOrderJourneySnapshot(order, sessionsByEmail);
    const campaignSession = order.marketingSession ?? touchSnapshot.lastPaidTouch ?? touchSnapshot.lastTouch;
    if (!campaignSession?.utmCampaign) continue;
    const key = `${campaignSession.sourceCategory}:${campaignSession.sourcePlatform}:${campaignSession.utmCampaign}`;
    const current = campaignMap.get(key) ?? {
      key,
      category: campaignSession.sourceCategory,
      platform: campaignSession.sourcePlatform,
      campaign: campaignSession.utmCampaign,
      confirmedOrders: 0,
      confirmedRevenue: 0,
      leadsCaptured: 0,
    };
    current.confirmedOrders += 1;
    current.confirmedRevenue += order.totalArs;
    campaignMap.set(key, current);
  }
  for (const event of filteredEvents) {
    const session = event.marketingSession;
    if (!session?.utmCampaign) continue;
    if (event.eventType !== MarketingEventType.POPUP_CAPTURED && event.eventType !== MarketingEventType.CART_CAPTURED) continue;
    const key = `${session.sourceCategory}:${session.sourcePlatform}:${session.utmCampaign}`;
    const current = campaignMap.get(key) ?? {
      key,
      category: session.sourceCategory,
      platform: session.sourcePlatform,
      campaign: session.utmCampaign,
      confirmedOrders: 0,
      confirmedRevenue: 0,
      leadsCaptured: 0,
    };
    current.leadsCaptured += 1;
    campaignMap.set(key, current);
  }

  const scopedEmails = new Set<string>();
  for (const lead of filteredLeads) scopedEmails.add(normalizeEmail(lead.email));
  for (const order of filteredOrders) scopedEmails.add(normalizeEmail(order.customerEmail));
  for (const session of filteredSessions) if (session.email) scopedEmails.add(normalizeEmail(session.email));

  const contacts = Array.from(scopedEmails)
    .filter(Boolean)
    .map((email) => buildContact(email, sessions, leads, orders, events, confirmedOrdersByEmail))
    .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact))
    .filter((contact) => !filters.onlyRepeat || contact.repeatCustomer)
    .sort((left, right) => (right.lastSeenAt?.getTime() ?? 0) - (left.lastSeenAt?.getTime() ?? 0))
    .slice(0, 120);

  const uniqueCustomers = new Set(filteredConfirmedOrders.map((order) => normalizeEmail(order.customerEmail)));
  const repeatCustomers = Array.from(uniqueCustomers).filter((email) => (confirmedOrdersByEmail.get(email)?.length ?? 0) > 1);
  const repeatRevenue = filteredConfirmedOrders
    .filter((order) => (confirmedOrdersByEmail.get(normalizeEmail(order.customerEmail))?.length ?? 0) > 1)
    .reduce((acc, order) => acc + order.totalArs, 0);

  return {
    filters,
    summary: {
      sessions: filteredSessions.length,
      emailsCaptured: new Set(filteredEvents.filter((event) => event.eventType === MarketingEventType.POPUP_CAPTURED || event.eventType === MarketingEventType.CART_CAPTURED).map((event) => normalizeEmail(event.email))).size,
      ordersCreated: filteredOrders.length,
      confirmedOrders: filteredConfirmedOrders.length,
      confirmedRevenue: filteredConfirmedOrders.reduce((acc, order) => acc + order.totalArs, 0),
      uniqueCustomers: uniqueCustomers.size,
      repeatCustomers: repeatCustomers.length,
      repeatCustomerRate: uniqueCustomers.size ? (repeatCustomers.length / uniqueCustomers.size) * 100 : 0,
      repeatRevenue,
    },
    categoryPerformance: Array.from(categoryMap.values()).sort((left, right) => right.confirmedRevenue - left.confirmedRevenue || right.sessions - left.sessions),
    campaignPerformance: Array.from(campaignMap.values()).sort((left, right) => right.confirmedRevenue - left.confirmedRevenue || right.leadsCaptured - left.leadsCaptured),
    contacts,
    recentOrders: filteredOrders
      .map((order) => {
        const touchSnapshot = getOrderJourneySnapshot(order, sessionsByEmail);
        const anchorSession = order.marketingSession ?? touchSnapshot.lastTouch ?? touchSnapshot.firstTouch;
        return {
          orderNumber: order.publicOrderNumber,
          email: order.customerEmail,
          createdAt: order.createdAt,
          paidAt: order.paidAt,
          totalArs: order.totalArs,
          paymentStatus: order.paymentStatus,
          repeatCustomer: (confirmedOrdersByEmail.get(normalizeEmail(order.customerEmail))?.length ?? 0) > 1,
          sourceLabel: anchorSession?.sourceLabel ?? "Sin atribucion",
          campaign: anchorSession?.utmCampaign ?? null,
          firstTouchLabel: touchSnapshot.firstTouch?.sourceLabel ?? "Sin dato",
          firstCampaign: touchSnapshot.firstTouch?.utmCampaign ?? null,
          lastTouchLabel: touchSnapshot.lastTouch?.sourceLabel ?? "Sin dato",
          lastCampaign: touchSnapshot.lastTouch?.utmCampaign ?? null,
          assistedCampaigns: touchSnapshot.assistedCampaigns.join(" | "),
          assistedPlatforms: touchSnapshot.assistedPlatforms.join(" | "),
          touchpoints: touchSnapshot.touchpoints,
          journeySummary: touchSnapshot.journeySummary,
        };
      })
      .filter((order) => !filters.onlyRepeat || order.repeatCustomer)
      .slice(0, 30),
  };
}

export function buildMarketingExportRows(data: MarketingDashboardData) {
  return data.contacts.map((contact) => ({
    email: contact.email,
    firstSeenAt: contact.firstSeenAt,
    lastSeenAt: contact.lastSeenAt,
    firstCategory: contact.firstTouch?.sourceCategory ?? "",
    firstPlatform: contact.firstTouch?.sourcePlatform ?? "",
    firstChannel: contact.firstTouch?.sourceChannel ?? "",
    firstLabel: contact.firstTouch?.sourceLabel ?? "",
    firstCampaign: contact.firstTouch?.utmCampaign ?? "",
    firstReferrer: contact.firstTouch?.referrerHost ?? "",
    lastCategory: contact.lastTouch?.sourceCategory ?? "",
    lastPlatform: contact.lastTouch?.sourcePlatform ?? "",
    lastChannel: contact.lastTouch?.sourceChannel ?? "",
    lastLabel: contact.lastTouch?.sourceLabel ?? "",
    lastCampaign: contact.lastTouch?.utmCampaign ?? "",
    firstPaidLabel: contact.firstPaidTouch?.sourceLabel ?? "",
    firstPaidCampaign: contact.firstPaidTouch?.utmCampaign ?? "",
    lastPaidLabel: contact.lastPaidTouch?.sourceLabel ?? "",
    lastPaidCampaign: contact.lastPaidTouch?.utmCampaign ?? "",
    assistedSources: contact.assistedSources.join(" | "),
    assistedPlatforms: contact.assistedPlatforms.join(" | "),
    assistedCampaigns: contact.assistedCampaigns.join(" | "),
    touchpoints: contact.touchpoints,
    journeySummary: contact.journeySummary,
    popupCapturedAt: contact.popupCapturedAt,
    cartCapturedAt: contact.cartCapturedAt,
    firstOrderAt: contact.firstOrderAt,
    lastOrderAt: contact.lastOrderAt,
    confirmedOrders: contact.confirmedOrders,
    totalRevenue: contact.totalRevenue,
    repeatCustomer: contact.repeatCustomer ? "SI" : "NO",
    lastOrderNumber: contact.lastOrderNumber ?? "",
    timeline: contact.timeline.map((item) => `${item.type} ${item.path} ${item.detail}`).join(" | "),
  }));
}

const sessionSelect = {
  id: true,
  email: true,
  visitorId: true,
  sessionKey: true,
  entryPath: true,
  entryUrl: true,
  sourceCategory: true,
  sourcePlatform: true,
  sourceChannel: true,
  sourceLabel: true,
  utmCampaign: true,
  utmSource: true,
  utmMedium: true,
  utmContent: true,
  utmTerm: true,
  referrerHost: true,
  isPaid: true,
  firstSeenAt: true,
  lastSeenAt: true,
};

const leadSelect = {
  id: true,
  email: true,
  status: true,
  subtotalArs: true,
  createdAt: true,
  updatedAt: true,
  checkoutStartedAt: true,
  convertedAt: true,
  convertedOrderNumber: true,
  marketingSession: { select: sessionSelect },
};

const orderSelect = {
  id: true,
  publicOrderNumber: true,
  customerEmail: true,
  paymentStatus: true,
  orderStatus: true,
  totalArs: true,
  subtotalArs: true,
  shippingArs: true,
  paymentMethod: true,
  createdAt: true,
  paidAt: true,
  marketingSession: { select: sessionSelect },
};

const eventSelect = {
  id: true,
  eventType: true,
  path: true,
  email: true,
  occurredAt: true,
  marketingSession: { select: sessionSelect },
  order: {
    select: {
      id: true,
      publicOrderNumber: true,
      totalArs: true,
      paymentStatus: true,
    },
  },
  cartRecoveryLead: {
    select: {
      id: true,
      status: true,
      subtotalArs: true,
    },
  },
};

function matchesSessionFilter(session: SessionRecord, filters: MarketingDashboardFilters) {
  if (filters.dateFrom && session.firstSeenAt < filters.dateFrom) return false;
  if (filters.dateTo && session.firstSeenAt > filters.dateTo) return false;
  if (filters.sourceCategory !== "ALL" && session.sourceCategory !== filters.sourceCategory) return false;
  if (filters.sourcePlatform !== "ALL" && session.sourcePlatform !== filters.sourcePlatform) return false;
  if (!filters.search) return true;

  return [session.email, session.sourceLabel, session.utmCampaign, session.utmSource, session.utmContent, session.referrerHost, session.entryPath]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(filters.search));
}

function matchesScopedRecordFilter(date: Date, email: string | null, session: SessionRecord | null, filters: MarketingDashboardFilters) {
  if (filters.dateFrom && date < filters.dateFrom) return false;
  if (filters.dateTo && date > filters.dateTo) return false;
  if (filters.sourceCategory !== "ALL" && session?.sourceCategory !== filters.sourceCategory) return false;
  if (filters.sourcePlatform !== "ALL" && session?.sourcePlatform !== filters.sourcePlatform) return false;
  if (!filters.search) return true;

  return [email, session?.sourceLabel, session?.utmCampaign, session?.utmSource, session?.utmContent].filter(Boolean).some((value) => String(value).toLowerCase().includes(filters.search));
}

function matchesOrderFilter(order: OrderRecord, filters: MarketingDashboardFilters) {
  if (!matchesScopedRecordFilter(order.createdAt, order.customerEmail, order.marketingSession, filters)) return false;
  if (!filters.search) return true;
  return order.publicOrderNumber.toLowerCase().includes(filters.search) || order.customerEmail.toLowerCase().includes(filters.search);
}

function matchesEventFilter(event: EventRecord, filters: MarketingDashboardFilters) {
  if (!matchesScopedRecordFilter(event.occurredAt, event.email, event.marketingSession, filters)) return false;
  if (!filters.search) return true;
  return [event.path, event.order?.publicOrderNumber].filter(Boolean).some((value) => String(value).toLowerCase().includes(filters.search));
}

function buildContact(
  email: string,
  sessions: SessionRecord[],
  leads: LeadRecord[],
  orders: OrderRecord[],
  events: EventRecord[],
  confirmedOrdersByEmail: Map<string, OrderRecord[]>,
) {
  const emailSessions = sessions.filter((session) => normalizeEmail(session.email) === email).sort((left, right) => left.firstSeenAt.getTime() - right.firstSeenAt.getTime());
  const emailLeads = leads.filter((lead) => normalizeEmail(lead.email) === email).sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const emailOrders = orders.filter((order) => normalizeEmail(order.customerEmail) === email).sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const emailEvents = events
    .filter((event) => normalizeEmail(event.email ?? event.marketingSession?.email ?? null) === email)
    .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());

  if (!emailSessions.length && !emailLeads.length && !emailOrders.length && !emailEvents.length) {
    return null;
  }

  const confirmedOrders = confirmedOrdersByEmail.get(email) ?? [];
  const journeySnapshot = summarizeJourney(emailSessions);
  const timeline = [
    ...emailSessions.map((session) => ({
      type: "Sesion iniciada",
      occurredAt: session.firstSeenAt,
      path: session.entryPath,
      detail: buildSessionDescriptor(session),
    })),
    ...emailEvents.map((event) => ({
      type: eventLabel(event.eventType),
      occurredAt: event.occurredAt,
      path: event.path,
      detail: event.order?.publicOrderNumber ?? event.cartRecoveryLead?.status ?? "",
    })),
  ].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime()).slice(0, 12);

  return {
    email,
    firstSeenAt: emailSessions[0]?.firstSeenAt ?? emailLeads[0]?.createdAt ?? emailOrders[0]?.createdAt ?? null,
    lastSeenAt: emailSessions[emailSessions.length - 1]?.lastSeenAt ?? emailOrders[emailOrders.length - 1]?.createdAt ?? null,
    firstTouch: journeySnapshot.firstTouch,
    lastTouch: journeySnapshot.lastTouch,
    firstPaidTouch: journeySnapshot.firstPaidTouch,
    lastPaidTouch: journeySnapshot.lastPaidTouch,
    popupCapturedAt: emailEvents.find((event) => event.eventType === MarketingEventType.POPUP_CAPTURED)?.occurredAt ?? null,
    cartCapturedAt: emailEvents.find((event) => event.eventType === MarketingEventType.CART_CAPTURED)?.occurredAt ?? emailLeads.find((lead) => lead.status !== "WELCOME_CAPTURED")?.createdAt ?? null,
    firstOrderAt: emailOrders[0]?.createdAt ?? null,
    lastOrderAt: emailOrders[emailOrders.length - 1]?.createdAt ?? null,
    confirmedOrders: confirmedOrders.length,
    totalRevenue: confirmedOrders.reduce((acc, order) => acc + order.totalArs, 0),
    repeatCustomer: confirmedOrders.length > 1,
    lastOrderNumber: emailOrders[emailOrders.length - 1]?.publicOrderNumber ?? null,
    assistedSources: journeySnapshot.assistedSources,
    assistedPlatforms: journeySnapshot.assistedPlatforms,
    assistedCampaigns: journeySnapshot.assistedCampaigns,
    touchpoints: journeySnapshot.touchpoints,
    journeySummary: journeySnapshot.journeySummary,
    timeline,
  };
}

function summarizeJourney(sessions: SessionRecord[]): JourneySnapshot {
  const orderedSessions = [...sessions].sort((left, right) => left.firstSeenAt.getTime() - right.firstSeenAt.getTime());
  const meaningfulSessions = orderedSessions.filter((session) => isMeaningfulSession(session));
  const firstTouch = meaningfulSessions[0] ?? orderedSessions[0] ?? null;
  const lastTouch = meaningfulSessions[meaningfulSessions.length - 1] ?? orderedSessions[orderedSessions.length - 1] ?? null;
  const paidSessions = meaningfulSessions.filter((session) => session.isPaid);

  return {
    firstTouch,
    lastTouch,
    firstPaidTouch: paidSessions[0] ?? null,
    lastPaidTouch: paidSessions[paidSessions.length - 1] ?? null,
    assistedSources: uniqueStrings(meaningfulSessions.map((session) => session.sourceLabel)),
    assistedPlatforms: uniqueStrings(meaningfulSessions.map((session) => session.sourcePlatform)),
    assistedCampaigns: uniqueStrings(meaningfulSessions.map((session) => session.utmCampaign)),
    touchpoints: orderedSessions.length,
    journeySummary: orderedSessions.map((session) => buildSessionDescriptor(session)).join(" -> "),
  };
}

function getOrderJourneySnapshot(order: OrderRecord, sessionsByEmail: Map<string, SessionRecord[]>): JourneySnapshot {
  const email = normalizeEmail(order.customerEmail);
  const sessions = (sessionsByEmail.get(email) ?? []).filter((session) => session.firstSeenAt <= order.createdAt);
  return summarizeJourney(sessions);
}

function groupSessionsByEmail(sessions: SessionRecord[]) {
  const map = new Map<string, SessionRecord[]>();

  for (const session of sessions) {
    const email = normalizeEmail(session.email);
    if (!email) continue;
    const current = map.get(email) ?? [];
    current.push(session);
    current.sort((left, right) => left.firstSeenAt.getTime() - right.firstSeenAt.getTime());
    map.set(email, current);
  }

  return map;
}

function isMeaningfulSession(session: SessionRecord) {
  return session.sourceCategory !== MarketingSourceCategory.DIRECT || Boolean(session.utmCampaign || session.utmSource || session.referrerHost);
}

function buildSessionDescriptor(session: SessionRecord) {
  const campaign = session.utmCampaign ? ` / ${session.utmCampaign}` : "";
  return `${session.sourceLabel}${campaign}`;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

function emptyCategoryRow(key: string, label: string) {
  return {
    key,
    label,
    sessions: 0,
    popupLeads: 0,
    cartLeads: 0,
    ordersCreated: 0,
    confirmedOrders: 0,
    confirmedRevenue: 0,
    repeatOrders: 0,
  };
}

function isConfirmedOrder(order: OrderRecord) {
  return confirmedPaymentStatuses.has(order.paymentStatus) && !cancelledOrderStatuses.has(order.orderStatus);
}

function groupByEmail(orders: OrderRecord[]) {
  const map = new Map<string, OrderRecord[]>();

  for (const order of orders) {
    const email = normalizeEmail(order.customerEmail);
    const current = map.get(email) ?? [];
    current.push(order);
    current.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    map.set(email, current);
  }

  return map;
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function eventLabel(eventType: MarketingEventType) {
  switch (eventType) {
    case MarketingEventType.SESSION_STARTED:
      return "Sesion iniciada";
    case MarketingEventType.POPUP_CAPTURED:
      return "Popup";
    case MarketingEventType.CART_CAPTURED:
      return "Carrito";
    case MarketingEventType.ORDER_CREATED:
      return "Pedido";
    case MarketingEventType.ORDER_CONFIRMED:
      return "Compra confirmada";
    default:
      return eventType;
  }
}
