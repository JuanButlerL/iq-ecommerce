import { ReferralCreditStatus } from "@prisma/client";

import { sendEmail } from "@/features/email/provider";
import { getReferralBalance, refreshReferralCredits } from "@/features/referrals/credits";
import { buildReferralCreditEmail } from "@/features/referrals/emails";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

const NOTICE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Runs from the email cron: moves credits forward and emails the referrer when one is credited. */
export async function processReferralCredits() {
  const refresh = await refreshReferralCredits();
  const toNotify = await prisma.referralCredit.findMany({
    where: { status: ReferralCreditStatus.AVAILABLE, notifiedAt: null },
    include: { account: { select: { id: true, email: true, firstName: true, status: true } } },
    orderBy: { availableAt: "asc" },
    take: 50,
  });
  let notified = 0;

  for (const credit of toNotify) {
    const isStale = !credit.availableAt || Date.now() - credit.availableAt.getTime() > NOTICE_MAX_AGE_MS;

    if (isStale || !credit.account.email || credit.account.status !== "ACTIVE") {
      await prisma.referralCredit.update({ where: { id: credit.id }, data: { notifiedAt: new Date() } });
      continue;
    }

    if (!env.canSendEmail) {
      continue;
    }

    try {
      const { balanceArs } = await getReferralBalance(credit.accountId);
      const email = buildReferralCreditEmail({
        firstName: credit.account.firstName,
        amountArs: credit.amountArs,
        balanceArs,
        expiresAt: credit.expiresAt ?? new Date(),
        portalUrl: `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/referidos`,
      });

      await sendEmail({
        fromEmail: env.EMAIL_FROM_DEFAULT,
        senderName: "IQ Kids",
        to: credit.account.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      await prisma.referralCredit.update({ where: { id: credit.id }, data: { notifiedAt: new Date() } });
      notified += 1;
    } catch (error) {
      console.error("referral credit notice failed", { creditId: credit.id, error });
    }
  }

  return { ...refresh, notified };
}
