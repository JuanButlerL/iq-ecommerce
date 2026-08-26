import { ProductForm } from "@/features/admin/components/product-form";
import { requireAdminSection } from "@/lib/auth/admin";

export default async function AdminNewProductPage() {
  await requireAdminSection("products");
  return <ProductForm mode="create" />;
}
