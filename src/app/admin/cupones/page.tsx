import { CouponsAdminPanel } from "@/features/admin/components/coupons-admin-panel";
import { getCouponProductOptions, getCouponsForClient } from "@/features/coupons/queries";
import { requireAdminSection } from "@/lib/auth/admin";

export default async function AdminCouponsPage() {
  await requireAdminSection("coupons");
  const [coupons, products] = await Promise.all([getCouponsForClient(), getCouponProductOptions()]);

  return <CouponsAdminPanel coupons={coupons} products={products} />;
}
