import { ReferralCouponKind, type Coupon } from "@prisma/client";

import { buildCouponSummary, type CouponLine } from "@/features/coupons/lib/coupon-pricing";
import { getReferralBalance, refreshReferralCredits } from "@/features/referrals/credits";
import { getFriendIneligibility, type CustomerIdentity } from "@/features/referrals/eligibility";
import { taxIdIdentity } from "@/features/referrals/normalize";
import { getReferralSettings } from "@/features/referrals/settings";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";

export const FRIEND_NOT_NEW_MESSAGE =
  "Este código es para familias que compran por primera vez en IQ Kids. Si ya compraste, podés pedirle a tu amiga que te lo cuente por otro lado 😉";
const SELF_REFERRAL_MESSAGE = "No podés usar tu propio código de referidos.";

/**
 * Pricing and checks for the two referral coupons. `customer` is the full checkout data (only at
 * order creation); the preview only knows the DNI, if the customer already typed it.
 */
export async function getReferralCouponSummary(
  coupon: Coupon,
  input: { taxId?: string | null; subtotalArs: number; eligibleLines: CouponLine[] | null; customer?: CustomerIdentity },
) {
  const settings = await getReferralSettings();
  const account = coupon.referralAccountId
    ? await prisma.referralAccount.findUnique({ where: { id: coupon.referralAccountId } })
    : null;

  if (!settings.enabled || !account || account.status !== "ACTIVE") {
    throw new AppError(`El cupón ${coupon.code} no existe o no está activo.`, 400);
  }

  const taxId = taxIdIdentity(input.taxId);

  if (coupon.referralKind === ReferralCouponKind.REFERRER_CREDIT) {
    if (!taxId) {
      throw new AppError("Para usar tu crédito, completá primero tu DNI en tus datos.", 400);
    }

    if (taxId !== taxIdIdentity(account.taxId)) {
      throw new AppError("Este código de crédito es personal: se usa con el DNI de su titular.", 400);
    }

    await refreshReferralCredits({ accountId: account.id });
    const { balanceArs } = await getReferralBalance(account.id);

    if (balanceArs <= 0) {
      throw new AppError("Todavía no tenés crédito disponible para usar.", 400);
    }

    return {
      ...buildCouponSummary({ ...coupon, discountType: "FIXED_AMOUNT", fixedDiscountArs: balanceArs }, input.subtotalArs, input.eligibleLines ?? []),
      referral: { kind: coupon.referralKind, accountId: account.id, creditAmountArs: settings.creditAmountArs },
    };
  }

  const friend: CustomerIdentity = input.customer ?? { taxId };

  if (taxId || input.customer) {
    const reason = await getFriendIneligibility(account, friend);

    if (reason) {
      throw new AppError(reason.startsWith("autorreferido") ? SELF_REFERRAL_MESSAGE : FRIEND_NOT_NEW_MESSAGE, 400);
    }
  }

  return {
    ...buildCouponSummary(
      { ...coupon, discountType: "PERCENTAGE", discountPercentage: coupon.discountPercentage ?? settings.friendDiscountPercentage } as Coupon,
      input.subtotalArs,
      input.eligibleLines ?? [],
    ),
    referral: { kind: coupon.referralKind as ReferralCouponKind, accountId: account.id, creditAmountArs: settings.creditAmountArs },
  };
}
