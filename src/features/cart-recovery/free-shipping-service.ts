import { randomUUID } from "crypto";
import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

const FREE_SHIPPING_BENEFIT_HOURS = 72;
const confirmedPaymentStatuses = [PaymentStatus.PAID, PaymentStatus.PROOF_UPLOADED];
const cancelledOrderStatuses = [OrderStatus.CANCELLED, OrderStatus.EXPIRED];

type RecoveryItem = {
  productId: string;
  quantity: number;
};

type PrismaClient = typeof prisma | Prisma.TransactionClient;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseRecoveryItems(value: Prisma.JsonValue): RecoveryItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items: RecoveryItem[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }

    const productId = "productId" in item ? item.productId : null;
    const quantity = "quantity" in item ? item.quantity : null;

    if (typeof productId !== "string" || !productId || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      return null;
    }

    items.push({ productId, quantity });
  }

  return items;
}

export function hasSameRecoveryCart(savedItems: Prisma.JsonValue, checkoutItems: RecoveryItem[]) {
  const parsedItems = parseRecoveryItems(savedItems);

  if (!parsedItems || parsedItems.length !== checkoutItems.length) {
    return false;
  }

  const savedByProduct = new Map(parsedItems.map((item) => [item.productId, item.quantity]));

  return checkoutItems.every((item) => savedByProduct.get(item.productId) === item.quantity);
}

function hasSingleProductLine(savedItems: Prisma.JsonValue) {
  const parsedItems = parseRecoveryItems(savedItems);
  return Boolean(parsedItems && parsedItems.length === 1);
}

async function hasConfirmedPurchase(db: PrismaClient, email: string) {
  return db.order.findFirst({
    where: {
      customerEmail: {
        equals: normalizeEmail(email),
        mode: "insensitive",
      },
      paymentStatus: {
        in: confirmedPaymentStatuses,
      },
      orderStatus: {
        notIn: cancelledOrderStatuses,
      },
    },
    select: { id: true },
  });
}

export async function grantCartRecoveryFreeShippingBenefit(leadId: string) {
  const lead = await prisma.cartRecoveryLead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      email: true,
      items: true,
      freeShippingToken: true,
      freeShippingExpiresAt: true,
      freeShippingRedeemedAt: true,
    },
  });

  if (!lead || lead.freeShippingRedeemedAt || !hasSingleProductLine(lead.items) || (await hasConfirmedPurchase(prisma, lead.email))) {
    return null;
  }

  const now = new Date();

  if (lead.freeShippingToken && lead.freeShippingExpiresAt && lead.freeShippingExpiresAt > now) {
    return lead.freeShippingToken;
  }

  const token = randomUUID();
  const expiresAt = new Date(now.getTime() + FREE_SHIPPING_BENEFIT_HOURS * 60 * 60 * 1000);

  await prisma.cartRecoveryLead.update({
    where: { id: lead.id },
    data: {
      freeShippingToken: token,
      freeShippingGrantedAt: now,
      freeShippingExpiresAt: expiresAt,
      freeShippingRedeemedAt: null,
      freeShippingOrderId: null,
    },
  });

  return token;
}

export async function canUseCartRecoveryFreeShippingBenefit(input: {
  token?: string;
  email: string;
  items: RecoveryItem[];
}) {
  if (!input.token) {
    return false;
  }

  const lead = await prisma.cartRecoveryLead.findFirst({
    where: {
      freeShippingToken: input.token,
      freeShippingRedeemedAt: null,
      freeShippingExpiresAt: { gt: new Date() },
      email: {
        equals: normalizeEmail(input.email),
        mode: "insensitive",
      },
    },
    select: { email: true, items: true },
  });

  return Boolean(lead && hasSingleProductLine(lead.items) && hasSameRecoveryCart(lead.items, input.items) && !(await hasConfirmedPurchase(prisma, lead.email)));
}

export async function redeemCartRecoveryFreeShippingBenefit(
  db: Prisma.TransactionClient,
  input: { token: string; email: string; items: RecoveryItem[]; orderId: string },
) {
  const lead = await db.cartRecoveryLead.findFirst({
    where: {
      freeShippingToken: input.token,
      freeShippingRedeemedAt: null,
      freeShippingExpiresAt: { gt: new Date() },
      email: {
        equals: normalizeEmail(input.email),
        mode: "insensitive",
      },
    },
    select: { id: true, email: true, items: true },
  });

  if (!lead || !hasSingleProductLine(lead.items) || !hasSameRecoveryCart(lead.items, input.items) || (await hasConfirmedPurchase(db, lead.email))) {
    return false;
  }

  const claimed = await db.cartRecoveryLead.updateMany({
    where: {
      id: lead.id,
      freeShippingToken: input.token,
      freeShippingRedeemedAt: null,
      freeShippingExpiresAt: { gt: new Date() },
    },
    data: {
      freeShippingRedeemedAt: new Date(),
      freeShippingOrderId: input.orderId,
    },
  });

  return claimed.count === 1;
}
