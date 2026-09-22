import type { Prisma } from "@prisma/client";

// Mandatory fixed UTC cutover. Never fall back to historical activation dates.
export function getPostPurchaseCutoff(value: string | undefined, activatedAt: Date | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value) || !activatedAt) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString().replace(".000Z", "Z") !== value.replace(".000Z", "Z")) return null;
  return new Date(Math.max(date.getTime(), activatedAt.getTime()));
}

export function postPurchaseWhere(automationId: string, cutoff: Date, readyAt: Date): Prisma.OrderWhereInput {
  const eventRange = { gte: cutoff, lte: readyAt };
  return {
    paymentStatus: { in: ["PROOF_UPLOADED", "PAID"] },
    orderStatus: { notIn: ["CANCELLED", "EXPIRED"] },
    // Errors and reservations require reconciliation, never automatic retries.
    emailLogs: { none: { automationId, targetType: "order" } },
    OR: [
      { paidAt: eventRange },
      {
        paidAt: null,
        paymentProofs: {
          some: { uploadedAt: eventRange },
          none: { uploadedAt: { gt: readyAt } },
        },
      },
    ],
  };
}
