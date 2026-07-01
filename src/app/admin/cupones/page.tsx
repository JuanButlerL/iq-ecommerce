import { CouponsAdminPanel } from "@/features/admin/components/coupons-admin-panel";
import { getCouponsForClient } from "@/features/coupons/queries";
import { requireAdminSection } from "@/lib/auth/admin";

export default async function AdminCouponsPage() {
  await requireAdminSection("coupons");
  const coupons = await getCouponsForClient();

  return <CouponsAdminPanel coupons={coupons} />;
}
