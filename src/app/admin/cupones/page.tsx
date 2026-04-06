import { CouponsAdminPanel } from "@/features/admin/components/coupons-admin-panel";
import { getCoupons } from "@/features/coupons/queries";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminCouponsPage() {
  await requireAdmin();
  const coupons = await getCoupons();

  return <CouponsAdminPanel coupons={coupons} />;
}
