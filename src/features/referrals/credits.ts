import { Prisma, ReferralCreditStatus } from "@prisma/client";

import { CANCELLED_ORDER_STATUSES, CONFIRMED_PAYMENT_STATUSES, getFriendIneligibility } from "@/features/referrals/eligibility";
import { taxIdIdentity } from "@/features/referrals/normalize";
import { getReferralSettings, type ReferralSettingsView } from "@/features/referrals/settings";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";

const DAY_MS = 24 * 60 * 60 * 1000;
// An unpaid order keeps the credit it used for this long; after that the credit is free again.
const UNPAID_RESERVATION_MS = 48 * 60 * 60 * 1000;
// Orders with a friend code that are never paid stop being tracked after this.
const UNPAID_FRIEND_ORDER_MAX_AGE_MS = 30 * DAY_MS;

type DbClient = Prisma.TransactionClient | typeof prisma;

/** Whether a credit use still counts against the balance. */
function activeUseOrderWhere(now: Date): Prisma.OrderWhereInput {
  return {
    orderStatus: { notIn: CANCELLED_ORDER_STATUSES },
    OR: [{ paymentStatus: { in: CONFIRMED_PAYMENT_STATUSES } }, { createdAt: { gte: new Date(now.getTime() - UNPAID_RESERVATION_MS) } }],
  };
}

/** Available credits with what is left of each, soonest to expire first. */
export async function getAvailableCredits(db: DbClient, accountId: string, now = new Date()) {
  const credits = await db.referralCredit.findMany({
    where: { accountId, status: ReferralCreditStatus.AVAILABLE, expiresAt: { gt: now } },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
    include: { uses: { where: { order: activeUseOrderWhere(now) }, select: { amountArs: true } } },
  });

  return credits
    .map((credit) => ({
      id: credit.id,
      expiresAt: credit.expiresAt as Date,
      amountArs: credit.amountArs,
      remainingArs: Math.max(credit.amountArs - credit.uses.reduce((total, use) => total + use.amountArs, 0), 0),
    }))
    .filter((credit) => credit.remainingArs > 0);
}

export async function getReferralBalance(accountId: string, now = new Date()) {
  const credits = await getAvailableCredits(prisma, accountId, now);
  return {
    balanceArs: credits.reduce((total, credit) => total + credit.remainingArs, 0),
    nextExpiry: credits[0]?.expiresAt ?? null,
  };
}

/**
 * Spends `amountArs` of the account's credit on an order, inside the checkout transaction. The
 * account row is locked so two checkouts at the same time cannot spend the same credit.
 */
export async function spendReferralCredit(tx: Prisma.TransactionClient, input: { accountId: string; orderId: string; amountArs: number }) {
  if (input.amountArs <= 0) {
    return;
  }

  await tx.$queryRaw`SELECT id FROM referral_accounts WHERE id = ${input.accountId}::uuid FOR UPDATE`;
  const credits = await getAvailableCredits(tx, input.accountId);
  const balance = credits.reduce((total, credit) => total + credit.remainingArs, 0);

  if (balance < input.amountArs) {
    throw new AppError("Tu saldo de crédito cambió. Volvé a aplicar el código para ver el monto actualizado.", 409);
  }

  let pending = input.amountArs;

  for (const credit of credits) {
    if (pending <= 0) break;
    const amountArs = Math.min(credit.remainingArs, pending);
    await tx.referralCreditUse.create({ data: { creditId: credit.id, orderId: input.orderId, amountArs } });
    pending -= amountArs;
  }
}

async function markAvailable(creditId: string, settings: ReferralSettingsView, now: Date, reviewedBy?: string) {
  await prisma.referralCredit.update({
    where: { id: creditId },
    data: {
      status: ReferralCreditStatus.AVAILABLE,
      availableAt: now,
      expiresAt: new Date(now.getTime() + settings.creditValidityDays * DAY_MS),
      ...(reviewedBy ? { reviewedBy } : {}),
    },
  });
}

async function reject(creditId: string, note: string, reviewedBy = "system") {
  await prisma.referralCredit.update({
    where: { id: creditId },
    data: { status: ReferralCreditStatus.REJECTED, reviewNote: note, reviewedBy },
  });
}

/**
 * Final checks before a credit turns available: the friend did not buy before this order and no
 * earlier order of the same friend already earned a credit.
 */
async function getCreditRejection(credit: {
  id: string;
  referredTaxId: string;
  createdAt: Date;
  account: { taxId: string; email: string | null; phone: string | null };
  referredOrder: {
    id: string;
    createdAt: Date;
    customerTaxId: string | null;
    customerEmail: string;
    customerPhone: string;
    addressLine: string;
    addressNumber: string | null;
    postalCode: string;
  };
}) {
  const order = credit.referredOrder;
  const reason = await getFriendIneligibility(
    credit.account,
    {
      taxId: order.customerTaxId,
      email: order.customerEmail,
      phone: order.customerPhone,
      addressLine: order.addressLine,
      addressNumber: order.addressNumber,
      postalCode: order.postalCode,
    },
    { excludeOrderId: order.id, before: order.createdAt },
  );

  if (reason) {
    return reason;
  }

  const duplicated = await prisma.referralCredit.findFirst({
    where: {
      id: { not: credit.id },
      referredTaxId: taxIdIdentity(credit.referredTaxId),
      status: { in: [ReferralCreditStatus.AVAILABLE, ReferralCreditStatus.PENDING] },
      createdAt: { lt: credit.createdAt },
      referredOrder: { paymentStatus: { in: CONFIRMED_PAYMENT_STATUSES }, orderStatus: { notIn: CANCELLED_ORDER_STATUSES } },
    },
    select: { id: true },
  });

  return duplicated ? "la persona invitada ya generó un crédito con otro pedido" : null;
}

/**
 * Moves pending credits forward: rejects them when the order was cancelled, starts the hold when the
 * payment is confirmed and makes them available when the hold ends (unless approval is manual).
 * Safe to run any number of times.
 */
export async function refreshReferralCredits(options: { accountId?: string } = {}) {
  const settings = await getReferralSettings();
  const now = new Date();
  const pending = await prisma.referralCredit.findMany({
    where: { status: ReferralCreditStatus.PENDING, ...(options.accountId ? { accountId: options.accountId } : {}) },
    include: {
      account: { select: { taxId: true, email: true, phone: true, status: true } },
      referredOrder: {
        select: {
          id: true,
          createdAt: true,
          paymentStatus: true,
          orderStatus: true,
          customerTaxId: true,
          customerEmail: true,
          customerPhone: true,
          addressLine: true,
          addressNumber: true,
          postalCode: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  let madeAvailable = 0;

  for (const credit of pending) {
    const order = credit.referredOrder;

    if ((CANCELLED_ORDER_STATUSES as string[]).includes(order.orderStatus)) {
      await reject(credit.id, "pedido cancelado o vencido");
      continue;
    }

    const isConfirmed = (CONFIRMED_PAYMENT_STATUSES as string[]).includes(order.paymentStatus);

    if (!isConfirmed) {
      if (now.getTime() - order.createdAt.getTime() > UNPAID_FRIEND_ORDER_MAX_AGE_MS) {
        await reject(credit.id, "pedido sin pago");
      }
      continue;
    }

    let holdUntil = credit.holdUntil;

    if (!credit.confirmedAt) {
      holdUntil = new Date(now.getTime() + settings.creditHoldDays * DAY_MS);
      await prisma.referralCredit.update({ where: { id: credit.id }, data: { confirmedAt: now, holdUntil } });
    }

    if (settings.requireManualApproval || credit.account.status === "BLOCKED" || (holdUntil && holdUntil > now)) {
      continue;
    }

    const rejection = await getCreditRejection(credit);

    if (rejection) {
      await reject(credit.id, rejection);
      continue;
    }

    await markAvailable(credit.id, settings, now);
    madeAvailable += 1;
  }

  return { checked: pending.length, madeAvailable };
}

/** Admin approval: checks run again, but the admin can force it when they know better. */
export async function approveReferralCredit(creditId: string, reviewedBy: string, force = false) {
  const credit = await prisma.referralCredit.findUnique({
    where: { id: creditId },
    include: {
      account: { select: { taxId: true, email: true, phone: true } },
      referredOrder: {
        select: {
          id: true,
          createdAt: true,
          paymentStatus: true,
          orderStatus: true,
          customerTaxId: true,
          customerEmail: true,
          customerPhone: true,
          addressLine: true,
          addressNumber: true,
          postalCode: true,
        },
      },
    },
  });

  if (!credit) throw new AppError("Crédito no encontrado.", 404);
  if (credit.status !== ReferralCreditStatus.PENDING && credit.status !== ReferralCreditStatus.REJECTED) {
    throw new AppError("Solo se pueden aprobar créditos pendientes o rechazados.", 400);
  }

  const order = credit.referredOrder;
  if (!(CONFIRMED_PAYMENT_STATUSES as string[]).includes(order.paymentStatus) || (CANCELLED_ORDER_STATUSES as string[]).includes(order.orderStatus)) {
    throw new AppError("El pedido de la persona invitada todavía no está confirmado.", 400);
  }

  if (!force) {
    const rejection = await getCreditRejection(credit);
    if (rejection) {
      throw new AppError(`No pasa los controles: ${rejection}. Si igual corresponde, aprobalo forzado.`, 400);
    }
  }

  const settings = await getReferralSettings();
  await markAvailable(credit.id, settings, new Date(), reviewedBy);
  await prisma.referralCredit.update({ where: { id: credit.id }, data: { reviewNote: force ? "aprobado a mano (forzado)" : "aprobado a mano", confirmedAt: credit.confirmedAt ?? new Date() } });
}

export async function voidReferralCredit(creditId: string, reviewedBy: string, note: string) {
  const credit = await prisma.referralCredit.findUnique({ where: { id: creditId }, select: { status: true } });
  if (!credit) throw new AppError("Crédito no encontrado.", 404);
  if (credit.status === ReferralCreditStatus.VOIDED) return;

  await prisma.referralCredit.update({
    where: { id: creditId },
    data: { status: ReferralCreditStatus.VOIDED, reviewedBy, reviewNote: note.trim() || "anulado desde el admin" },
  });
}
