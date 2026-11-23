import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { ReferralAccessForm } from "@/features/referrals/components/referral-access-form";
import { ReferralCodeSetup } from "@/features/referrals/components/referral-code-setup";
import { ReferralDashboard } from "@/features/referrals/components/referral-dashboard";
import { getReferralPortalData } from "@/features/referrals/portal";
import { getReferralSessionAccount } from "@/features/referrals/session";
import { getReferralSettings } from "@/features/referrals/settings";
import { getStoreSettings } from "@/features/settings/queries";
import { formatArs } from "@/lib/utils/currency";
import { buildWhatsappUrl } from "@/lib/utils/whatsapp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Club de Familias iQ",
  description: "Compartí IQ Kids con tus amigas: ellas tienen un descuento en su primera compra y vos sumás crédito.",
  robots: { index: false, follow: false },
};

export default async function ReferralPortalPage() {
  const settings = await getReferralSettings();

  if (!settings.enabled) {
    notFound();
  }

  const account = await getReferralSessionAccount();

  if (account) {
    const data = await getReferralPortalData(account);

    return (
      <Container className="max-w-4xl py-10 md:py-14">
        {data.hasCodes && data.friendCode && data.creditCode ? (
          <ReferralDashboard
            firstName={data.firstName}
            friendCode={data.friendCode}
            creditCode={data.creditCode}
            balanceArs={data.balanceArs}
            nextExpiry={data.nextExpiry}
            friendsCount={data.friendsCount}
            history={data.history}
            shareMessage={data.shareMessage}
            shareImageUrl={data.shareImageUrl}
            terms={data.terms}
            friendDiscountPercentage={data.friendDiscountPercentage}
            creditAmountArs={data.creditAmountArs}
          />
        ) : (
          <Card className="mx-auto max-w-xl space-y-5 p-5 md:p-8">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Club de Familias iQ</p>
              <h1 className="font-display text-3xl leading-tight text-brand-ink md:text-4xl">
                {data.firstName ? `¡Hola ${data.firstName}! Armá tu código` : "Armá tu código"}
              </h1>
            </div>
            <ReferralCodeSetup suggestedCode={data.suggestedCode} terms={data.terms} percentage={data.friendDiscountPercentage} />
          </Card>
        )}
      </Container>
    );
  }

  const storeSettings = await getStoreSettings();
  const whatsappUrl = storeSettings?.whatsappNumber
    ? buildWhatsappUrl(storeSettings.whatsappNumber, "Hola! Quiero sumarme al Club de Familias iQ y no me llega el link.")
    : null;

  return (
    <Container className="py-10 md:py-16">
      <Card className="mx-auto max-w-xl space-y-6 p-5 md:p-8">
        <div className="space-y-2">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Club de Familias iQ</p>
          <h1 className="font-display text-4xl leading-none text-brand-ink md:text-5xl">Lo bueno se comparte</h1>
          <p className="text-sm leading-6 text-brand-ink/70 md:text-base">
            Tus amigas tienen <strong>{settings.friendDiscountPercentage}% off</strong> en su primera compra con tu código, y vos sumás{" "}
            <strong>{formatArs(settings.creditAmountArs)}</strong> de crédito por cada una que compre. Sin tope.
          </p>
        </div>
        <ReferralAccessForm whatsappUrl={whatsappUrl} />
      </Card>
    </Container>
  );
}
