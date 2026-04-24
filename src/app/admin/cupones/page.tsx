import { CouponsAdminPanel } from "@/features/admin/components/coupons-admin-panel";
import { getCouponsForClient } from "@/features/coupons/queries";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminCouponsPage() {
  await requireAdmin();
  const coupons = await getCouponsForClient();

  return <CouponsAdminPanel coupons={coupons} />;
}
