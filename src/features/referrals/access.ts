import { after } from "next/server";
import { z } from "zod";

import { sendEmail } from "@/features/email/provider";
import { findLatestConfirmedRetailOrderByTaxId } from "@/features/referrals/eligibility";
import { buildReferralLoginEmail } from "@/features/referrals/emails";
import { isValidReferralTaxId, maskEmail, normalizeTaxId, taxIdIdentity } from "@/features/referrals/normalize";
import { generateLoginToken, hashLoginToken, isReferralSessionConfigured } from "@/features/referrals/session";
import { getReferralSettings } from "@/features/referrals/settings";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { consumeRateLimits } from "@/lib/security/rate-limit";

const LOGIN_TOKEN_MINUTES = 30;

export const ACCESS_NOT_FOUND_MESSAGE =
  "No encontramos compras en iqkids.com.ar con ese DNI. Si compraste con otro DNI o por otro canal, escribinos y lo vemos.";

const accessSchema = z.object({ taxId: z.string().trim().min(1).max(20) });

export async function requestReferralAccess(payload: unknown, request: { ip: string }) {
  const settings = await getReferralSettings();

  if (!settings.enabled || !isReferralSessionConfigured()) {
    throw new AppError("El Club de Familias iQ no está disponible en este momento.", 403);
  }

  const parsed = accessSchema.safeParse(payload);
  const taxId = normalizeTaxId(parsed.success ? parsed.data.taxId : "");

  if (!isValidReferralTaxId(taxId)) {
    throw new AppError("Ingresá tu DNI sin puntos (7 u 8 números) o tu CUIL.", 400);
  }

  const identity = taxIdIdentity(taxId);
  const allowed = await consumeRateLimits([
    { scope: "referral-access-ip", identifier: request.ip, limit: 8, windowSeconds: 15 * 60 },
    { scope: "referral-access-ip-day", identifier: request.ip, limit: 40, windowSeconds: 24 * 60 * 60 },
    { scope: "referral-access-dni", identifier: identity, limit: 3, windowSeconds: 60 * 60 },
  ]);

  if (!allowed) {
    throw new AppError("Hiciste muchos intentos seguidos. Esperá un rato y probá de nuevo.", 429);
  }

  const existing = await prisma.referralAccount.findUnique({ where: { taxId: identity } });
  // Only customers with a confirmed web purchase can join; their email comes from that purchase.
  const order = existing?.status === "BLOCKED" ? null : await findLatestConfirmedRetailOrderByTaxId(identity);

  if (!order) {
    return { found: false, maskedEmail: null, message: ACCESS_NOT_FOUND_MESSAGE };
  }

  // The link is sent after the response, so a slow email provider does not hold the form.
  after(() =>
    sendAccessLink(identity, existing, order).catch((error) => {
      console.error("referral access link failed", error);
    }),
  );

  // Only a hint (first and last letter + domain) so the person knows which inbox to check.
  return { found: true, maskedEmail: maskEmail(order.customerEmail), message: null };
}

async function sendAccessLink(
  identity: string,
  existing: Awaited<ReturnType<typeof prisma.referralAccount.findUnique>>,
  order: NonNullable<Awaited<ReturnType<typeof findLatestConfirmedRetailOrderByTaxId>>>,
) {

  const account = existing
    ? await prisma.referralAccount.update({
        where: { id: existing.id },
        data: { email: order.customerEmail, phone: order.customerPhone, firstName: existing.firstName ?? order.customerFirstName },
      })
    : await prisma.referralAccount.create({
        data: { taxId: identity, email: order.customerEmail, phone: order.customerPhone, firstName: order.customerFirstName },
      });
  const { token, tokenHash } = generateLoginToken();

  await prisma.referralLoginToken.create({
    data: {
      accountId: account.id,
      tokenHash,
      email: order.customerEmail,
      expiresAt: new Date(Date.now() + LOGIN_TOKEN_MINUTES * 60 * 1000),
    },
  });

  if (!env.canSendEmail) {
    console.warn("referral access link not sent: email sending is disabled");
    return;
  }

  // The token goes in the fragment (#), so it never reaches server logs or Referer headers.
  const url = `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/referidos/ingresar#${token}`;
  const email = buildReferralLoginEmail({ firstName: account.firstName, url, minutes: LOGIN_TOKEN_MINUTES });

  await sendEmail({
    fromEmail: env.EMAIL_FROM_DEFAULT,
    senderName: "IQ Kids",
    to: order.customerEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

const tokenSchema = z.object({ token: z.string().trim().min(20).max(100) });

/** Exchanges the one-time token from the email for the account (the route sets the cookie). */
export async function consumeReferralLoginToken(payload: unknown, request: { ip: string }) {
  const allowed = await consumeRateLimits([{ scope: "referral-token-ip", identifier: request.ip, limit: 20, windowSeconds: 15 * 60 }]);

  if (!allowed) {
    throw new AppError("Hiciste muchos intentos seguidos. Esperá un rato y probá de nuevo.", 429);
  }

  const parsed = tokenSchema.safeParse(payload);
  const invalid = new AppError("El link venció o ya se usó. Pedí uno nuevo con tu DNI.", 400);

  if (!parsed.success) {
    throw invalid;
  }

  const tokenHash = hashLoginToken(parsed.data.token);
  const now = new Date();
  // Conditional update: two tabs opening the same link cannot both sign in.
  const claimed = await prisma.referralLoginToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });

  if (claimed.count !== 1) {
    throw invalid;
  }

  const loginToken = await prisma.referralLoginToken.findUnique({ where: { tokenHash }, include: { account: true } });

  if (!loginToken || loginToken.account.status === "BLOCKED") {
    throw invalid;
  }

  return prisma.referralAccount.update({ where: { id: loginToken.accountId }, data: { lastLoginAt: now } });
}
