import { ReferralCouponKind, ReferralCreditStatus } from "@prisma/client";
import { z } from "zod";

import { getReferralBalance, refreshReferralCredits } from "@/features/referrals/credits";
import { DEFAULT_REFERRAL_SHARE_MESSAGE, DEFAULT_REFERRAL_TERMS, getReferralSettings } from "@/features/referrals/settings";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { formatArgentinaDate, formatArgentinaDateTime } from "@/lib/utils/datetime";

const CREDIT_STATUS_LABELS: Record<ReferralCreditStatus, string> = {
  PENDING: "Pendiente",
  AVAILABLE: "Acreditado",
  REJECTED: "Rechazado",
  VOIDED: "Anulado",
};

const isActiveUse = (use: { order: { orderStatus: string } }) => use.order.orderStatus !== "CANCELLED" && use.order.orderStatus !== "EXPIRED";

export async function getReferralAdminData() {
  await refreshReferralCredits();
  const [settings, accounts, credits] = await Promise.all([
    getReferralSettings(),
    prisma.referralAccount.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
      include: {
        coupons: { select: { code: true, referralKind: true } },
        credits: { select: { status: true } },
      },
    }),
    prisma.referralCredit.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        account: { select: { taxId: true, firstName: true, coupons: { select: { code: true, referralKind: true } } } },
        referredOrder: {
          select: {
            publicOrderNumber: true,
            customerFirstName: true,
            customerLastName: true,
            paymentStatus: true,
            paymentMethod: true,
            orderStatus: true,
            totalArs: true,
          },
        },
        uses: { select: { amountArs: true, order: { select: { publicOrderNumber: true, orderStatus: true } } } },
      },
    }),
  ]);
  const balances = await Promise.all(accounts.map((account) => getReferralBalance(account.id)));

  return {
    settings,
    defaults: { shareMessage: DEFAULT_REFERRAL_SHARE_MESSAGE, termsText: DEFAULT_REFERRAL_TERMS },
    accounts: accounts.map((account, index) => ({
      id: account.id,
      taxId: account.taxId,
      firstName: account.firstName,
      email: account.email,
      status: account.status,
      createdAt: account.createdAt,
      activatedAt: account.activatedAt,
      friendCode: account.coupons.find((coupon) => coupon.referralKind === ReferralCouponKind.FRIEND_DISCOUNT)?.code ?? null,
      creditCode: account.coupons.find((coupon) => coupon.referralKind === ReferralCouponKind.REFERRER_CREDIT)?.code ?? null,
      creditsAvailable: account.credits.filter((credit) => credit.status === ReferralCreditStatus.AVAILABLE).length,
      creditsPending: account.credits.filter((credit) => credit.status === ReferralCreditStatus.PENDING).length,
      balanceArs: balances[index].balanceArs,
    })),
    credits: credits.map((credit) => ({
      id: credit.id,
      createdAt: credit.createdAt,
      status: credit.status,
      statusLabel: CREDIT_STATUS_LABELS[credit.status],
      amountArs: credit.amountArs,
      referrerTaxId: credit.account.taxId,
      referrerName: credit.account.firstName,
      friendCode: credit.account.coupons.find((coupon) => coupon.referralKind === ReferralCouponKind.FRIEND_DISCOUNT)?.code ?? null,
      orderNumber: credit.referredOrder.publicOrderNumber,
      friendName: `${credit.referredOrder.customerFirstName} ${credit.referredOrder.customerLastName}`.trim(),
      orderPaymentStatus: credit.referredOrder.paymentStatus,
      orderPaymentMethod: credit.referredOrder.paymentMethod,
      orderStatus: credit.referredOrder.orderStatus,
      orderTotalArs: credit.referredOrder.totalArs,
      confirmedAt: credit.confirmedAt,
      availableAt: credit.availableAt,
      expiresAt: credit.expiresAt,
      reviewNote: credit.reviewNote,
      reviewedBy: credit.reviewedBy,
      usedArs: credit.uses.filter(isActiveUse).reduce((total, use) => total + use.amountArs, 0),
      usedInOrders: credit.uses.filter(isActiveUse).map((use) => use.order.publicOrderNumber),
    })),
  };
}

export type ReferralAdminData = Awaited<ReturnType<typeof getReferralAdminData>>;

const settingsSchema = z.object({
  enabled: z.boolean(),
  friendDiscountPercentage: z.coerce.number().min(1).max(50),
  creditAmountArs: z.coerce.number().int().min(100).max(200000),
  creditValidityDays: z.coerce.number().int().min(7).max(730),
  creditHoldDays: z.coerce.number().int().min(0).max(60),
  requireManualApproval: z.boolean(),
  shareMessage: z.string().trim().max(1000),
  shareImageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => !value || /^https:\/\//.test(value) || value.startsWith("/"), "La imagen tiene que ser un link https o una ruta del sitio.")
    .optional()
    .or(z.literal("")),
  termsText: z.string().trim().max(4000),
});

export async function saveReferralSettings(payload: unknown) {
  const parsed = settingsSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Revisá los datos.", 400);
  }

  const data = { ...parsed.data, shareImageUrl: parsed.data.shareImageUrl || null };
  const previous = await getReferralSettings();

  await prisma.$transaction(async (tx) => {
    await tx.referralSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });

    // The friend codes carry the percentage themselves (it shows in the checkout and the Sheets).
    if (previous.friendDiscountPercentage !== data.friendDiscountPercentage) {
      await tx.coupon.updateMany({
        where: { referralKind: ReferralCouponKind.FRIEND_DISCOUNT },
        data: { discountPercentage: data.friendDiscountPercentage },
      });
    }
  });
}

export async function setReferralAccountBlocked(accountId: string, blocked: boolean, adminEmail: string) {
  const account = await prisma.referralAccount.findUnique({ where: { id: accountId }, include: { coupons: { select: { id: true } } } });

  if (!account) {
    throw new AppError("Embajadora no encontrada.", 404);
  }

  const nextStatus = blocked ? "BLOCKED" : account.coupons.length ? "ACTIVE" : "INVITED";

  await prisma.$transaction([
    prisma.referralAccount.update({
      where: { id: accountId },
      data: {
        status: nextStatus,
        // Signs her out of every browser.
        sessionVersion: { increment: blocked ? 1 : 0 },
        notes: `${account.notes ? `${account.notes}\n` : ""}${formatArgentinaDateTime(new Date())} ${blocked ? "bloqueada" : "desbloqueada"} por ${adminEmail}`,
      },
    }),
    prisma.coupon.updateMany({ where: { referralAccountId: accountId }, data: { active: !blocked } }),
  ]);
}

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  // Leading = + - @ would run as a formula in Sheets/Excel.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** One row per credit, for the "Referidos" table in the AppSheet. */
export async function buildReferralCreditsCsv() {
  const data = await getReferralAdminData();
  const header = [
    "fecha",
    "codigo",
    "embajadora_dni",
    "embajadora_nombre",
    "pedido",
    "amiga",
    "pago",
    "estado_pedido",
    "estado_credito",
    "monto",
    "acreditado",
    "vence",
    "usado",
    "nota",
  ];
  const rows = data.credits.map((credit) => [
    formatArgentinaDate(credit.createdAt),
    credit.friendCode,
    credit.referrerTaxId,
    credit.referrerName,
    credit.orderNumber,
    credit.friendName,
    credit.orderPaymentStatus,
    credit.orderStatus,
    credit.statusLabel,
    credit.amountArs,
    credit.availableAt ? formatArgentinaDate(credit.availableAt) : "",
    credit.expiresAt ? formatArgentinaDate(credit.expiresAt) : "",
    credit.usedArs,
    credit.reviewNote,
  ]);

  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
