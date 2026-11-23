import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { ReferralLoginConfirm } from "@/features/referrals/components/referral-login-confirm";

export const metadata: Metadata = {
  title: "Entrar al Club de Familias iQ",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ReferralLoginPage() {
  return (
    <Container className="py-10 md:py-16">
      <Card className="mx-auto max-w-md space-y-5 p-5 md:p-8">
        <div>
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Club de Familias iQ</p>
          <h1 className="font-display text-3xl leading-tight text-brand-ink md:text-4xl">Ya casi estás</h1>
          <p className="mt-1 text-sm leading-6 text-brand-ink/70">Tocá el botón para entrar a tu portal.</p>
        </div>
        <ReferralLoginConfirm />
      </Card>
    </Container>
  );
}
