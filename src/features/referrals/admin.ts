import { ReferralCouponKind, ReferralCreditStatus } from "@prisma/client";
import { z } from "zod";

import { getReferralBalance, refreshReferralCredits } from "@/features/referrals/credits";
import { findLatestConfirmedRetailOrderByTaxId } from "@/features/referrals/eligibility";
import { isValidReferralTaxId, normalizeFriendCode, normalizeTaxId, taxIdIdentity } from "@/features/referrals/normalize";
import { createCodesForAccount } from "@/features/referrals/portal";
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
    throw new AppError("Referidor/a no encontrado/a.", 404);
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
    "referidor_dni",
    "referidor_nombre",
    "pedido",
    "invitado",
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

const BULK_MAX_LINES = 300;

export type ReferralBulkResult = { line: number; taxId: string; code: string; ok: boolean; message: string };

/**
 * Admin bulk load: one "DNI CODE" per line (space, tab, comma or semicolon; either order). Creates the
 * account and both codes for each DNI with a confirmed web purchase. Works with the program off, so
 * the codes can be ready before the launch. The person accepts the rules when they open the portal.
 */
export async function bulkCreateReferralCodes(payload: unknown, adminEmail: string) {
  const parsed = z.object({ text: z.string().max(20000) }).safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Pegá la lista de DNI y código, uno por renglón.", 400);
  }

  const lines = parsed.data.text
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, raw: line.trim() }))
    .filter((entry) => entry.raw);

  if (!lines.length) {
    throw new AppError("La lista está vacía.", 400);
  }

  if (lines.length > BULK_MAX_LINES) {
    throw new AppError(`Se pueden cargar hasta ${BULK_MAX_LINES} renglones por vez.`, 400);
  }

  const settings = await getReferralSettings();
  const results: ReferralBulkResult[] = [];

  for (const entry of lines) {
    const tokens = entry.raw.split(/[\s,;]+/).filter(Boolean);
    const taxToken = tokens.find((token) => isValidReferralTaxId(normalizeTaxId(token)) && /^[\d.\-]+$/.test(token)) ?? "";
    const codeToken = tokens.find((token) => token !== taxToken) ?? "";
    const taxId = taxIdIdentity(taxToken);
    const code = normalizeFriendCode(codeToken);
    const fail = (message: string) => results.push({ line: entry.line, taxId, code, ok: false, message });

    if (!taxToken || !codeToken || tokens.length > 2) {
      fail("Formato: DNI y código, por ejemplo 30123456 SOFI15.");
      continue;
    }

    try {
      const existing = await prisma.referralAccount.findUnique({
        where: { taxId },
        include: { coupons: { select: { code: true, referralKind: true } } },
      });

      if (existing?.status === "BLOCKED") {
        fail("Está bloqueado/a en Referidos.");
        continue;
      }

      const existingCode = existing?.coupons.find((coupon) => coupon.referralKind === ReferralCouponKind.FRIEND_DISCOUNT)?.code;

      if (existingCode) {
        fail(`Ya tiene su código: ${existingCode}.`);
        continue;
      }

      const order = await findLatestConfirmedRetailOrderByTaxId(taxId);

      if (!order) {
        fail("El DNI no tiene compras confirmadas en la web.");
        continue;
      }

      const account = existing
        ? await prisma.referralAccount.update({
            where: { id: existing.id },
            data: { email: order.customerEmail, phone: order.customerPhone, firstName: existing.firstName ?? order.customerFirstName },
          })
        : await prisma.referralAccount.create({
            data: { taxId, email: order.customerEmail, phone: order.customerPhone, firstName: order.customerFirstName, invitedBy: adminEmail },
          });

      await createCodesForAccount(account, code, { percentage: settings.friendDiscountPercentage, termsAccepted: false });
      results.push({ line: entry.line, taxId, code, ok: true, message: `Creado para ${order.customerFirstName}.` });
    } catch (error) {
      fail(error instanceof AppError ? error.message : "Error inesperado.");
      if (!(error instanceof AppError)) console.error("referral bulk load failed", { line: entry.line, error });
    }
  }

  return { created: results.filter((result) => result.ok).length, failed: results.filter((result) => !result.ok).length, results };
}
