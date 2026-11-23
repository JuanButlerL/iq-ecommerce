import { ReferralsAdminPanel } from "@/features/referrals/components/referrals-admin-panel";
import { getReferralAdminData } from "@/features/referrals/admin";
import { isReferralSessionConfigured } from "@/features/referrals/session";
import { requireAdminSection } from "@/lib/auth/admin";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  await requireAdminSection("referrals");
  const data = await getReferralAdminData();

  return <ReferralsAdminPanel data={data} warnings={{ sessionSecretMissing: !isReferralSessionConfigured(), emailDisabled: !env.canSendEmail }} />;
}
