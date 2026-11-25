import { CouponDiscountType, CouponUsageType, Prisma, ReferralCouponKind, ReferralCreditStatus, type ReferralAccount } from "@prisma/client";
import { z } from "zod";

import { CANCELLED_ORDER_STATUSES, CONFIRMED_PAYMENT_STATUSES } from "@/features/referrals/eligibility";
import { getReferralBalance, refreshReferralCredits } from "@/features/referrals/credits";
import { generateCreditCode, normalizeFriendCode, REFERRAL_FRIEND_CODE_PATTERN, suggestFriendCode } from "@/features/referrals/normalize";
import { fillReferralTemplate, getReferralSettings } from "@/features/referrals/settings";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { consumeRateLimit } from "@/lib/security/rate-limit";

const RESERVED_CODE_WORDS = ["IQKIDS", "IQ", "ADMIN", "GRATIS", "FREE", "TEST", "PRUEBA", "CRED", "MAYORISTA", "BLACK", "CYBER", "WELCOME", "BIENVENIDA"];

const createCodesSchema = z.object({
  friendCode: z.string().trim().min(1).max(30),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Tenés que aceptar las reglas para seguir." }) }),
});

function assertFriendCodeAllowed(code: string) {
  if (!REFERRAL_FRIEND_CODE_PATTERN.test(code)) {
    throw new AppError("El código tiene que tener entre 4 y 15 letras o números, sin espacios ni símbolos.", 400);
  }

  if (!/[A-Z]/.test(code)) {
    throw new AppError("El código tiene que incluir al menos una letra, por ejemplo tu nombre.", 400);
  }

  if (RESERVED_CODE_WORDS.some((word) => code === word || code.startsWith(word))) {
    throw new AppError("Ese código no está disponible. Probá con tu nombre, por ejemplo SOFI15.", 400);
  }
}

export async function createReferralCodes(account: ReferralAccount, payload: unknown) {
  const settings = await getReferralSettings();

  if (!settings.enabled) {
    throw new AppError("El Club de Familias iQ no está disponible en este momento.", 403);
  }

  const withinLimit = await consumeRateLimit({ scope: "referral-create-code", identifier: account.id, limit: 20, windowSeconds: 60 * 60 });

  if (!withinLimit) {
    throw new AppError("Hiciste muchos intentos seguidos. Esperá un rato y probá de nuevo.", 429);
  }

  const existing = await prisma.coupon.count({ where: { referralAccountId: account.id } });

  if (existing > 0) {
    throw new AppError("Ya tenés tus códigos creados.", 400);
  }

  const parsed = createCodesSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Revisá los datos.", 400);
  }

  return createCodesForAccount(account, parsed.data.friendCode, { percentage: settings.friendDiscountPercentage, termsAccepted: true });
}

/**
 * Creates the friend code and the personal credit code of an account. Used by the portal and by the
 * admin bulk load (which leaves the terms to be accepted by the person in the portal).
 */
export async function createCodesForAccount(
  account: { id: string; taxId: string },
  rawFriendCode: string,
  options: { percentage: number; termsAccepted: boolean },
) {
  const friendCode = normalizeFriendCode(rawFriendCode);
  assertFriendCodeAllowed(friendCode);

  const taken = await prisma.coupon.findFirst({ where: { code: { equals: friendCode, mode: "insensitive" } }, select: { id: true } });

  if (taken) {
    throw new AppError(`El código ${friendCode} ya está en uso. Probá con otro, por ejemplo agregando una inicial.`, 400);
  }

  const maskedDni = `***${account.taxId.slice(-3)}`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.coupon.create({
          data: {
            code: friendCode,
            description: `Referidos: código para invitar de DNI ${maskedDni}`,
            discountType: CouponDiscountType.PERCENTAGE,
            discountPercentage: options.percentage,
            usageType: CouponUsageType.UNLIMITED,
            active: true,
            referralKind: ReferralCouponKind.FRIEND_DISCOUNT,
            referralAccountId: account.id,
          },
        });
        await tx.coupon.create({
          data: {
            code: generateCreditCode(),
            description: `Referidos: crédito de DNI ${maskedDni}`,
            discountType: CouponDiscountType.FIXED_AMOUNT,
            usageType: CouponUsageType.UNLIMITED,
            active: true,
            referralKind: ReferralCouponKind.REFERRER_CREDIT,
            referralAccountId: account.id,
          },
        });
        await tx.referralAccount.update({
          where: { id: account.id },
          data: { status: "ACTIVE", activatedAt: new Date(), ...(options.termsAccepted ? { termsAcceptedAt: new Date() } : {}) },
        });
      });

      return { friendCode };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = String(error.meta?.target ?? "");

        // Someone else took the friend code at the same moment, or the account already has codes.
        if (!target.includes("code") || attempt === 4) {
          throw new AppError(`El código ${friendCode} ya está en uso. Probá con otro.`, 400);
        }

        const stillFree = !(await prisma.coupon.findUnique({ where: { code: friendCode }, select: { id: true } }));
        if (!stillFree) {
          throw new AppError(`El código ${friendCode} ya está en uso. Probá con otro.`, 400);
        }

        // The random credit code collided: try again with a new one.
        continue;
      }

      throw error;
    }
  }

  throw new AppError("No pudimos crear tus códigos. Probá de nuevo.", 500);
}

const creditStatusLabels = {
  waiting: "Esperando el pago",
  pending: "Confirmado, se acredita pronto",
  available: "Acreditado",
  used: "Usado",
  expired: "Vencido",
  rejected: "No válido",
} as const;

/** Everything the portal shows. No data of the friends is included. */
export async function getReferralPortalData(account: ReferralAccount) {
  const settings = await getReferralSettings();
  await refreshReferralCredits({ accountId: account.id });

  const [coupons, credits, balance] = await Promise.all([
    prisma.coupon.findMany({ where: { referralAccountId: account.id }, select: { code: true, referralKind: true } }),
    prisma.referralCredit.findMany({
      where: { accountId: account.id, status: { not: ReferralCreditStatus.VOIDED } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        referredOrder: { select: { paymentStatus: true, orderStatus: true } },
        uses: { select: { amountArs: true, order: { select: { paymentStatus: true, orderStatus: true, createdAt: true } } } },
      },
    }),
    getReferralBalance(account.id),
  ]);
  const friendCode = coupons.find((coupon) => coupon.referralKind === ReferralCouponKind.FRIEND_DISCOUNT)?.code ?? null;
  const creditCode = coupons.find((coupon) => coupon.referralKind === ReferralCouponKind.REFERRER_CREDIT)?.code ?? null;
  const now = Date.now();

  const history = credits.flatMap((credit) => {
    const isPaid = (CONFIRMED_PAYMENT_STATUSES as string[]).includes(credit.referredOrder.paymentStatus);
    const isCancelled = (CANCELLED_ORDER_STATUSES as string[]).includes(credit.referredOrder.orderStatus);

    // Unpaid orders that were abandoned are not worth showing.
    if (credit.status === ReferralCreditStatus.REJECTED && !isPaid) return [];
    if (credit.status === ReferralCreditStatus.PENDING && (!isPaid || isCancelled)) {
      return isCancelled ? [] : [{ id: credit.id, date: credit.createdAt, amountArs: credit.amountArs, status: creditStatusLabels.waiting, expiresAt: null }];
    }

    let status: string = creditStatusLabels.pending;

    if (credit.status === ReferralCreditStatus.REJECTED) status = creditStatusLabels.rejected;
    if (credit.status === ReferralCreditStatus.AVAILABLE) {
      const used = credit.uses
        .filter((use) => (CONFIRMED_PAYMENT_STATUSES as string[]).includes(use.order.paymentStatus) && !(CANCELLED_ORDER_STATUSES as string[]).includes(use.order.orderStatus))
        .reduce((total, use) => total + use.amountArs, 0);
      status = used >= credit.amountArs ? creditStatusLabels.used : credit.expiresAt && credit.expiresAt.getTime() < now ? creditStatusLabels.expired : creditStatusLabels.available;
    }

    return [{ id: credit.id, date: credit.createdAt, amountArs: credit.amountArs, status, expiresAt: credit.expiresAt }];
  });

  return {
    firstName: account.firstName,
    hasCodes: Boolean(friendCode && creditCode),
    suggestedCode: suggestFriendCode(account.firstName, settings.friendDiscountPercentage),
    friendCode,
    creditCode,
    balanceArs: balance.balanceArs,
    nextExpiry: balance.nextExpiry,
    friendsCount: history.filter((item) => item.status !== creditStatusLabels.waiting && item.status !== creditStatusLabels.rejected).length,
    history,
    shareMessage: friendCode ? fillReferralTemplate(settings.shareMessage, settings, friendCode) : "",
    shareImageUrl: settings.shareImageUrl,
    terms: fillReferralTemplate(settings.termsText, settings).split("\n").filter(Boolean),
    friendDiscountPercentage: settings.friendDiscountPercentage,
    creditAmountArs: settings.creditAmountArs,
    creditValidityDays: settings.creditValidityDays,
  };
}

export type ReferralPortalData = Awaited<ReturnType<typeof getReferralPortalData>>;
