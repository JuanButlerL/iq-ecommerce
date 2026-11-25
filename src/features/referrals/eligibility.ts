import { OrderStatus, PaymentStatus, Prisma, SalesChannel } from "@prisma/client";

import { normalizeAddress, normalizeEmail, normalizePhone, taxIdIdentity } from "@/features/referrals/normalize";
import { prisma } from "@/lib/db/prisma";

// A purchase counts once the customer paid with Mercado Pago or uploaded the transfer proof.
export const CONFIRMED_PAYMENT_STATUSES = [PaymentStatus.PAID, PaymentStatus.PROOF_UPLOADED];
// The friend's credit is released when the purchase is confirmed: Mercado Pago paid or transfer proof
// uploaded (Juan, 2026-11-25: the proof review in Admin > Comprobantes is for logistics, not for referrals).
export const CREDIT_RELEASE_PAYMENT_STATUSES: PaymentStatus[] = [PaymentStatus.PAID, PaymentStatus.PROOF_UPLOADED];
export const CANCELLED_ORDER_STATUSES = [OrderStatus.CANCELLED, OrderStatus.EXPIRED];

export const confirmedOrderWhere: Prisma.OrderWhereInput = {
  paymentStatus: { in: CONFIRMED_PAYMENT_STATUSES },
  orderStatus: { notIn: CANCELLED_ORDER_STATUSES },
};

// SQL versions of the normalizers in normalize.ts (address is compared in JS, it needs more rules).
const taxIdentitySql = Prisma.sql`(
  CASE WHEN length(regexp_replace(coalesce(o.customer_tax_id, ''), '\\D', '', 'g')) = 11
    THEN ltrim(substr(regexp_replace(o.customer_tax_id, '\\D', '', 'g'), 3, 8), '0')
    ELSE ltrim(regexp_replace(coalesce(o.customer_tax_id, ''), '\\D', '', 'g'), '0')
  END)`;
const emailSql = Prisma.sql`(
  CASE WHEN split_part(lower(trim(o.customer_email)), '@', 2) IN ('gmail.com', 'googlemail.com')
    THEN replace(split_part(split_part(lower(trim(o.customer_email)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    ELSE split_part(split_part(lower(trim(o.customer_email)), '@', 1), '+', 1) || '@' || split_part(lower(trim(o.customer_email)), '@', 2)
  END)`;
const phoneSql = Prisma.sql`right(regexp_replace(coalesce(o.customer_phone, ''), '\\D', '', 'g'), 10)`;

export type CustomerIdentity = {
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine?: string | null;
  addressNumber?: string | null;
  postalCode?: string | null;
};

export type IdentityMatch = "dni" | "email" | "telefono" | "direccion";

/**
 * Confirmed orders (any channel) that share the DNI, email, phone or address. `excludeOrderId` and
 * `before` let us re-check an order against the purchases that happened before it.
 */
export async function findPreviousPurchaseMatch(
  identity: CustomerIdentity,
  options: { excludeOrderId?: string; before?: Date } = {},
): Promise<IdentityMatch | null> {
  const taxId = taxIdIdentity(identity.taxId);
  const email = identity.email ? normalizeEmail(identity.email) : "";
  const phone = normalizePhone(identity.phone);
  const conditions: Array<{ match: IdentityMatch; sql: Prisma.Sql }> = [];

  if (taxId.length >= 6) conditions.push({ match: "dni", sql: Prisma.sql`${taxIdentitySql} = ${taxId}` });
  if (email.includes("@")) conditions.push({ match: "email", sql: Prisma.sql`${emailSql} = ${email}` });
  if (phone.length >= 8) conditions.push({ match: "telefono", sql: Prisma.sql`${phoneSql} = ${phone}` });

  const scope = Prisma.sql`o.payment_status::text IN ('PAID', 'PROOF_UPLOADED')
    AND o.order_status::text NOT IN ('CANCELLED', 'EXPIRED')
    ${options.excludeOrderId ? Prisma.sql`AND o.id <> ${options.excludeOrderId}::uuid` : Prisma.empty}
    ${options.before ? Prisma.sql`AND o.created_at < ${options.before}` : Prisma.empty}`;

  for (const condition of conditions) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT o.id FROM orders o WHERE ${scope} AND ${condition.sql} LIMIT 1
    `;

    if (rows.length) {
      return condition.match;
    }
  }

  const address = normalizeAddress(identity);

  if (address) {
    const candidates = await prisma.order.findMany({
      where: {
        ...confirmedOrderWhere,
        addressNumber: { contains: (identity.addressNumber ?? "").replace(/\D/g, "") },
        ...(options.excludeOrderId ? { id: { not: options.excludeOrderId } } : {}),
        ...(options.before ? { createdAt: { lt: options.before } } : {}),
      },
      select: { addressLine: true, addressNumber: true, postalCode: true },
      take: 500,
    });

    if (candidates.some((order) => normalizeAddress(order) === address)) {
      return "direccion";
    }
  }

  return null;
}

/** Whether two identities belong to the same person or household (self-referral check). */
export function sharesIdentity(left: CustomerIdentity, right: CustomerIdentity): IdentityMatch | null {
  const leftTax = taxIdIdentity(left.taxId);
  if (leftTax && leftTax === taxIdIdentity(right.taxId)) return "dni";

  const leftEmail = left.email ? normalizeEmail(left.email) : "";
  if (leftEmail && leftEmail === (right.email ? normalizeEmail(right.email) : "")) return "email";

  const leftPhone = normalizePhone(left.phone);
  if (leftPhone && leftPhone === normalizePhone(right.phone)) return "telefono";

  const leftAddress = normalizeAddress(left);
  if (leftAddress && leftAddress === normalizeAddress(right)) return "direccion";

  return null;
}

/** Latest confirmed retail purchase of a DNI: proves the person is a customer and gives the email. */
export async function findLatestConfirmedRetailOrderByTaxId(taxId: string) {
  const identity = taxIdIdentity(taxId);

  if (identity.length < 6) {
    return null;
  }

  // Loose filter in SQL, exact match in JS (DNI vs CUIL, dots, leading zeros).
  const candidates = await prisma.order.findMany({
    where: {
      ...confirmedOrderWhere,
      channel: SalesChannel.RETAIL,
      customerTaxId: { contains: identity.slice(-6) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      customerFirstName: true,
      customerEmail: true,
      customerPhone: true,
      customerTaxId: true,
      addressLine: true,
      addressNumber: true,
      postalCode: true,
    },
    take: 50,
  });

  return candidates.find((order) => taxIdIdentity(order.customerTaxId) === identity) ?? null;
}

/** Every identity the referrer has used in confirmed purchases, to catch self-referrals. */
export async function getReferrerIdentities(account: { taxId: string; email: string | null; phone: string | null }) {
  const identity = taxIdIdentity(account.taxId);
  const orders = await prisma.order.findMany({
    where: { ...confirmedOrderWhere, customerTaxId: { contains: identity.slice(-6) } },
    select: { customerTaxId: true, customerEmail: true, customerPhone: true, addressLine: true, addressNumber: true, postalCode: true },
    take: 100,
  });
  const ownOrders = orders.filter((order) => taxIdIdentity(order.customerTaxId) === identity);

  return [
    { taxId: account.taxId, email: account.email, phone: account.phone },
    ...ownOrders.map((order) => ({
      taxId: order.customerTaxId,
      email: order.customerEmail,
      phone: order.customerPhone,
      addressLine: order.addressLine,
      addressNumber: order.addressNumber,
      postalCode: order.postalCode,
    })),
  ] satisfies CustomerIdentity[];
}

/** Null when the friend can use the code; otherwise the internal reason (never shown as is). */
export async function getFriendIneligibility(
  account: { taxId: string; email: string | null; phone: string | null },
  friend: CustomerIdentity,
  options: { excludeOrderId?: string; before?: Date } = {},
): Promise<string | null> {
  const referrerIdentities = await getReferrerIdentities(account);

  for (const referrer of referrerIdentities) {
    const match = sharesIdentity(friend, referrer);
    if (match) return `autorreferido (${match})`;
  }

  const previous = await findPreviousPurchaseMatch(friend, options);
  return previous ? `ya compró antes (${previous})` : null;
}
