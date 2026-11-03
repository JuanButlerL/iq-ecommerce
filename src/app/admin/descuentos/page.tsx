import { ProductDiscountsAdminPanel } from "@/features/admin/components/product-discounts-admin-panel";
import { getAdminProductDiscounts } from "@/features/product-discounts/queries";
import { requireAdminSection } from "@/lib/auth/admin";

export default async function AdminDiscountsPage() {
  await requireAdminSection("discounts");
  const products = await getAdminProductDiscounts();

  return <ProductDiscountsAdminPanel products={products} />;
}
