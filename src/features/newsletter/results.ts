// Newsletter results: who opened, who clicked and who ended up buying.
//
// Pure functions only (no Prisma) so the rules can be tested and explained.
//
// A purchase counts for a newsletter when it is confirmed (paid or with proof uploaded,
// not cancelled or expired) and at least one of these happened:
//   * "click": the same email clicked that newsletter and bought within ATTRIBUTION_DAYS
//     after the first click (works even if they bought from another device);
//   * "link": the purchase came from a browser that entered the site through a link of
//     that newsletter (utm_campaign = its slug) within ATTRIBUTION_DAYS before buying.
//     This also catches forwarded emails and the web version.
// A recipient who opened (without clicking) and bought within the window is shown apart
// as "bought after opening": the email may have helped, but it is not counted as a sale.

export const ATTRIBUTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = ATTRIBUTION_DAYS * DAY_MS;

export type ResultsNewsletter = {
  id: string;
  slug: string;
  previousSlugs: string[];
  title: string;
  emailSubject: string;
  startedAt: Date;
};

export type ResultsDelivery = {
  recipientEmail: string;
  sentAt: Date | null;
  openCount: number;
  firstOpenedAt: Date | null;
  clickCount: number;
  firstClickedAt: Date | null;
  unsubscribedAt: Date | null;
};

export type ResultsOrder = {
  id: string;
  publicOrderNumber: string;
  customerEmail: string;
  customerName: string;
  createdAt: Date;
  totalArs: number;
  discountArs: number;
  couponCode: string | null;
  marketingSessionId: string | null;
  marketingVisitorId: string | null;
};

// A web visit that entered through a link of this newsletter.
export type ResultsVisit = {
  id: string;
  visitorId: string;
  email: string | null;
  firstSeenAt: Date;
};

export type PersonStatus = "BOUGHT" | "BOUGHT_AFTER_OPEN" | "CLICKED" | "OPENED" | "NOT_OPENED" | "FORWARDED_BUYER";

export type PersonOrder = {
  orderNumber: string;
  createdAt: Date;
  totalArs: number;
  discountArs: number;
  couponCode: string | null;
  via: Array<"click" | "link" | "open">;
  newCustomer: boolean;
  hoursFromEmail: number | null;
};

export type PersonRow = {
  email: string;
  name: string | null;
  status: PersonStatus;
  received: boolean;
  openCount: number;
  firstOpenedAt: Date | null;
  clickCount: number;
  firstClickedAt: Date | null;
  unsubscribed: boolean;
  orders: PersonOrder[];
  revenueArs: number;
};

export type NewsletterResultsSummary = {
  sent: number;
  opened: number;
  clicked: number;
  visits: number;
  buyers: number;
  orders: number;
  revenueArs: number;
  discountArs: number;
  newCustomers: number;
  boughtAfterOpen: number;
  forwardedBuyers: number;
  unsubscribed: number;
  openRate: number | null;
  clickRate: number | null;
  clickToOpenRate: number | null;
  conversionRate: number | null;
  clickConversionRate: number | null;
  averageTicketArs: number | null;
  revenuePerEmailArs: number | null;
  medianHoursToBuy: number | null;
  coupons: Array<{ code: string; orders: number; revenueArs: number }>;
};

export type NewsletterResults = {
  newsletter: ResultsNewsletter;
  summary: NewsletterResultsSummary;
  people: PersonRow[];
  attributedOrderIds: string[];
};

export function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function newsletterCampaigns(newsletter: Pick<ResultsNewsletter, "slug" | "previousSlugs">) {
  return [newsletter.slug, ...newsletter.previousSlugs].map((slug) => slug.trim().toLowerCase()).filter(Boolean);
}

function inWindow(value: Date, from: Date | null) {
  if (!from) return false;
  const diff = value.getTime() - from.getTime();
  return diff >= 0 && diff < WINDOW_MS;
}

function ratio(part: number, total: number) {
  return total > 0 ? part / total : null;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const statusOrder: Record<PersonStatus, number> = {
  BOUGHT: 0,
  FORWARDED_BUYER: 1,
  BOUGHT_AFTER_OPEN: 2,
  CLICKED: 3,
  OPENED: 4,
  NOT_OPENED: 5,
};

export function buildNewsletterResults(input: {
  newsletter: ResultsNewsletter;
  deliveries: ResultsDelivery[];
  orders: ResultsOrder[];
  visits: ResultsVisit[];
  // Emails with a confirmed purchase before a given date: used to tell new customers apart.
  previousPurchaseDates: Map<string, Date[]>;
}): NewsletterResults {
  const { newsletter, deliveries, visits, previousPurchaseDates } = input;
  const orders = input.orders.filter((order) => order.createdAt.getTime() >= newsletter.startedAt.getTime());

  const visitSessionIds = new Map<string, Date>();
  const visitsByVisitor = new Map<string, Date[]>();
  const visitsByEmail = new Map<string, Date[]>();
  for (const visit of visits) {
    visitSessionIds.set(visit.id, visit.firstSeenAt);
    visitsByVisitor.set(visit.visitorId, [...(visitsByVisitor.get(visit.visitorId) ?? []), visit.firstSeenAt]);
    const email = normalizeEmail(visit.email);
    if (email) visitsByEmail.set(email, [...(visitsByEmail.get(email) ?? []), visit.firstSeenAt]);
  }

  function cameFromLink(order: ResultsOrder) {
    const sessionStart = order.marketingSessionId ? visitSessionIds.get(order.marketingSessionId) : undefined;
    if (sessionStart && sessionStart.getTime() <= order.createdAt.getTime()) return true;
    const candidates = [
      ...(order.marketingVisitorId ? visitsByVisitor.get(order.marketingVisitorId) ?? [] : []),
      ...(visitsByEmail.get(normalizeEmail(order.customerEmail)) ?? []),
    ];
    return candidates.some((seenAt) => {
      const diff = order.createdAt.getTime() - seenAt.getTime();
      return diff >= 0 && diff < WINDOW_MS;
    });
  }

  function isNewCustomer(order: ResultsOrder) {
    const previous = previousPurchaseDates.get(normalizeEmail(order.customerEmail)) ?? [];
    return !previous.some((date) => date.getTime() < order.createdAt.getTime());
  }

  const ordersByEmail = new Map<string, ResultsOrder[]>();
  for (const order of orders) {
    const email = normalizeEmail(order.customerEmail);
    ordersByEmail.set(email, [...(ordersByEmail.get(email) ?? []), order]);
  }

  const people: PersonRow[] = [];
  const recipientEmails = new Set<string>();
  const attributed = new Map<string, ResultsOrder>();
  const hoursToBuy: number[] = [];

  function toPersonOrder(order: ResultsOrder, via: PersonOrder["via"], reference: Date | null): PersonOrder {
    const hours = reference ? (order.createdAt.getTime() - reference.getTime()) / 3_600_000 : null;
    return {
      orderNumber: order.publicOrderNumber,
      createdAt: order.createdAt,
      totalArs: order.totalArs,
      discountArs: order.discountArs,
      couponCode: order.couponCode,
      via,
      newCustomer: isNewCustomer(order),
      hoursFromEmail: hours === null ? null : Math.round(hours * 10) / 10,
    };
  }

  const uniqueDeliveries = new Map<string, ResultsDelivery>();
  for (const delivery of deliveries) {
    const email = normalizeEmail(delivery.recipientEmail);
    if (email && !uniqueDeliveries.has(email)) uniqueDeliveries.set(email, delivery);
  }

  for (const [email, delivery] of uniqueDeliveries) {
    recipientEmails.add(email);
    const ownOrders = ordersByEmail.get(email) ?? [];
    const sold: PersonOrder[] = [];
    const afterOpen: PersonOrder[] = [];

    for (const order of ownOrders) {
      const via: PersonOrder["via"] = [];
      if (inWindow(order.createdAt, delivery.firstClickedAt)) via.push("click");
      if (cameFromLink(order)) via.push("link");

      if (via.length > 0) {
        const reference = delivery.firstClickedAt ?? delivery.sentAt ?? newsletter.startedAt;
        const row = toPersonOrder(order, via, reference);
        sold.push(row);
        attributed.set(order.id, order);
        if (row.hoursFromEmail !== null) hoursToBuy.push(row.hoursFromEmail);
      } else if (inWindow(order.createdAt, delivery.firstOpenedAt)) {
        afterOpen.push(toPersonOrder(order, ["open"], delivery.firstOpenedAt));
      }
    }

    const status: PersonStatus =
      sold.length > 0
        ? "BOUGHT"
        : afterOpen.length > 0
          ? "BOUGHT_AFTER_OPEN"
          : delivery.firstClickedAt
            ? "CLICKED"
            : delivery.firstOpenedAt
              ? "OPENED"
              : "NOT_OPENED";
    const shownOrders = sold.length > 0 ? sold : afterOpen;

    people.push({
      email,
      name: ownOrders[0]?.customerName ?? null,
      status,
      received: true,
      openCount: delivery.openCount,
      firstOpenedAt: delivery.firstOpenedAt,
      clickCount: delivery.clickCount,
      firstClickedAt: delivery.firstClickedAt,
      unsubscribed: Boolean(delivery.unsubscribedAt && delivery.sentAt && inWindow(delivery.unsubscribedAt, delivery.sentAt)),
      orders: shownOrders,
      revenueArs: shownOrders.reduce((sum, order) => sum + order.totalArs, 0),
    });
  }

  // Buyers who did not receive this email but came through one of its links (forwarded or web version).
  for (const [email, ownOrders] of ordersByEmail) {
    if (recipientEmails.has(email)) continue;
    const sold = ownOrders.filter(cameFromLink);
    if (sold.length === 0) continue;
    const rows = sold.map((order) => {
      attributed.set(order.id, order);
      return toPersonOrder(order, ["link"], null);
    });
    people.push({
      email,
      name: sold[0].customerName,
      status: "FORWARDED_BUYER",
      received: false,
      openCount: 0,
      firstOpenedAt: null,
      clickCount: 0,
      firstClickedAt: null,
      unsubscribed: false,
      orders: rows,
      revenueArs: rows.reduce((sum, order) => sum + order.totalArs, 0),
    });
  }

  people.sort((left, right) => statusOrder[left.status] - statusOrder[right.status] || right.revenueArs - left.revenueArs || left.email.localeCompare(right.email));

  const attributedOrders = [...attributed.values()];
  const sent = uniqueDeliveries.size;
  const opened = people.filter((person) => person.received && person.firstOpenedAt).length;
  const clicked = people.filter((person) => person.received && person.firstClickedAt).length;
  const buyers = people.filter((person) => person.status === "BOUGHT" || person.status === "FORWARDED_BUYER").length;
  const revenueArs = attributedOrders.reduce((sum, order) => sum + order.totalArs, 0);
  const coupons = new Map<string, { code: string; orders: number; revenueArs: number }>();
  for (const order of attributedOrders) {
    const code = order.couponCode?.trim().toUpperCase() || "Sin cupón";
    const entry = coupons.get(code) ?? { code, orders: 0, revenueArs: 0 };
    entry.orders += 1;
    entry.revenueArs += order.totalArs;
    coupons.set(code, entry);
  }
  const clickBuyers = people.filter((person) => person.status === "BOUGHT" && person.firstClickedAt).length;

  return {
    newsletter,
    people,
    attributedOrderIds: attributedOrders.map((order) => order.id),
    summary: {
      sent,
      opened,
      clicked,
      visits: visits.length,
      buyers,
      orders: attributedOrders.length,
      revenueArs,
      discountArs: attributedOrders.reduce((sum, order) => sum + order.discountArs, 0),
      newCustomers: attributedOrders.filter(isNewCustomer).length,
      boughtAfterOpen: people.filter((person) => person.status === "BOUGHT_AFTER_OPEN").length,
      forwardedBuyers: people.filter((person) => person.status === "FORWARDED_BUYER").length,
      unsubscribed: people.filter((person) => person.unsubscribed).length,
      openRate: ratio(opened, sent),
      clickRate: ratio(clicked, sent),
      clickToOpenRate: ratio(clicked, opened),
      conversionRate: ratio(buyers, sent),
      clickConversionRate: ratio(clickBuyers, clicked),
      averageTicketArs: attributedOrders.length > 0 ? Math.round(revenueArs / attributedOrders.length) : null,
      revenuePerEmailArs: sent > 0 ? Math.round(revenueArs / sent) : null,
      medianHoursToBuy: median(hoursToBuy),
      coupons: [...coupons.values()].sort((left, right) => right.orders - left.orders),
    },
  };
}

export const personStatusMeta: Record<PersonStatus, { label: string; short: string; description: string; className: string }> = {
  BOUGHT: { label: "Compró", short: "Compró", description: "Hizo click (o entró por el link) y compró dentro de los 7 días.", className: "bg-green-100 text-green-800" },
  FORWARDED_BUYER: { label: "Compró por un reenvío", short: "Reenvío", description: "No recibió este mail, pero entró por uno de sus links y compró (se lo reenviaron o vio la versión web).", className: "bg-emerald-50 text-emerald-700" },
  BOUGHT_AFTER_OPEN: { label: "Abrió y compró sin click", short: "Abrió y compró", description: "Abrió el mail, no hizo click y compró dentro de los 7 días. Puede que el mail haya ayudado, pero no se cuenta como venta.", className: "bg-brand-cyan/25 text-sky-800" },
  CLICKED: { label: "Hizo click, no compró", short: "Click sin compra", description: "Le interesó pero no compró. Es la mejor lista para un recordatorio.", className: "bg-brand-yellow/40 text-amber-800" },
  OPENED: { label: "Abrió, no hizo click", short: "Solo abrió", description: "Abrió el mail pero no entró a la web.", className: "bg-brand-pink/12 text-brand-pink" },
  NOT_OPENED: { label: "No abrió", short: "No abrió", description: "No hay registro de apertura. Algunos clientes de mail bloquean el registro, así que puede haberlo visto igual.", className: "bg-brand-ink/8 text-brand-ink/55" },
};

// Dates travel to client components as ISO strings.
export type Serialized<T> = T extends Date
  ? string
  : T extends Array<infer Item>
    ? Serialized<Item>[]
    : T extends object
      ? { [Key in keyof T]: Serialized<T[Key]> }
      : T;

export function serializeResults(results: NewsletterResults) {
  return JSON.parse(JSON.stringify(results)) as Serialized<NewsletterResults>;
}

export function formatRate(value: number | null) {
  return value === null ? "—" : `${(Math.round(value * 1000) / 10).toLocaleString("es-AR")}%`;
}

export function formatHours(value: number | null) {
  if (value === null) return "—";
  if (value < 1) return "menos de 1 hora";
  if (value < 48) return `${Math.round(value)} h`;
  return `${Math.round(value / 24)} días`;
}

export const viaLabels: Record<PersonOrder["via"][number], string> = {
  click: "click en el mail",
  link: "entró por el link",
  open: "abrió el mail, sin click",
};
