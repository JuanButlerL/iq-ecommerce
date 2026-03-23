import { ProductForm } from "@/features/admin/components/product-form";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminNewProductPage() {
  await requireAdmin();
  return <ProductForm mode="create" />;
}
