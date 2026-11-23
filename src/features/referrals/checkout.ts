import { ReferralCouponKind, type Prisma } from "@prisma/client";

import { spendReferralCredit } from "@/features/referrals/credits";
import { taxIdIdentity } from "@/features/referrals/normalize";

/** Runs inside the checkout transaction, right after the order is created. */
export async function recordReferralOrder(
  tx: Prisma.TransactionClient,
  input: {
    referral: { kind: ReferralCouponKind; accountId: string; creditAmountArs: number };
    orderId: string;
    taxId: string;
    discountArs: number;
  },
) {
  if (input.referral.kind === ReferralCouponKind.REFERRER_CREDIT) {
    await spendReferralCredit(tx, { accountId: input.referral.accountId, orderId: input.orderId, amountArs: input.discountArs });
    return;
  }

  // Pending until the payment is confirmed; see refreshReferralCredits.
  await tx.referralCredit.create({
    data: {
      accountId: input.referral.accountId,
      referredOrderId: input.orderId,
      referredTaxId: taxIdIdentity(input.taxId),
      amountArs: input.referral.creditAmountArs,
    },
  });
}
