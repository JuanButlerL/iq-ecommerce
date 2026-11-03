import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";

import { FREE_SHIPPING_LINK_PARAM } from "@/features/free-shipping-links/constants";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";

export type FreeShippingLinkStatus = "ACTIVE" | "REDEEMED" | "EXPIRED" | "REVOKED";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getFreeShippingLinkStatus(
  link: { expiresAt: Date; revokedAt: Date | null; redeemedAt: Date | null },
  now = new Date(),
): FreeShippingLinkStatus {
  if (link.redeemedAt) return "REDEEMED";
  if (link.revokedAt) return "REVOKED";
  if (link.expiresAt <= now) return "EXPIRED";
  return "ACTIVE";
}

export function buildFreeShippingLinkUrl(token: string, baseUrl: string) {
  return new URL(`/carrito?${FREE_SHIPPING_LINK_PARAM}=${token}`, baseUrl).toString();
}

export async function createFreeShippingLinks(input: { emails: string[]; hours: number; note?: string; createdBy?: string }) {
  const emails = Array.from(new Set(input.emails.map(normalizeEmail)));
  const expiresAt = new Date(Date.now() + input.hours * 60 * 60 * 1000);

  return prisma.$transaction(
    emails.map((email) =>
      prisma.freeShippingLink.create({
        data: {
          email,
          token: randomUUID(),
          note: input.note || null,
          expiresAt,
          createdBy: input.createdBy ?? null,
        },
      }),
    ),
  );
}

export async function revokeFreeShippingLink(id: string) {
  const revoked = await prisma.freeShippingLink.updateMany({
    where: { id, redeemedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (revoked.count === 0) {
    throw new AppError("El link ya fue usado o anulado.", 409, true);
  }
}

export function listFreeShippingLinks() {
  return prisma.freeShippingLink.findMany({
    take: 300,
    orderBy: { createdAt: "desc" },
    include: { order: { select: { publicOrderNumber: true } } },
  });
}

// Public lookup used by the cart to prefill the email; only answers for links that still work.
export async function getActiveFreeShippingLink(token: string) {
  const link = await prisma.freeShippingLink.findUnique({
    where: { token },
    select: { email: true, expiresAt: true, revokedAt: true, redeemedAt: true },
  });

  return link && getFreeShippingLinkStatus(link) === "ACTIVE" ? { email: link.email, expiresAt: link.expiresAt } : null;
}

export async function canUseFreeShippingLink(input: { token?: string; email: string }) {
  if (!input.token) {
    return false;
  }

  const link = await prisma.freeShippingLink.findFirst({
    where: {
      token: input.token,
      email: normalizeEmail(input.email),
      revokedAt: null,
      redeemedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  return Boolean(link);
}

export async function redeemFreeShippingLink(db: Prisma.TransactionClient, input: { token: string; email: string; orderId: string }) {
  const claimed = await db.freeShippingLink.updateMany({
    where: {
      token: input.token,
      email: normalizeEmail(input.email),
      revokedAt: null,
      redeemedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { redeemedAt: new Date(), orderId: input.orderId },
  });

  return claimed.count === 1;
}
