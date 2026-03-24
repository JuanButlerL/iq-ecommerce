import { ShippingRuleForm } from "@/features/admin/components/shipping-rule-form";
import { getShippingRules } from "@/features/settings/queries";
import { requireAdmin } from "@/lib/auth/admin";
import { notFound } from "next/navigation";

export default async function AdminShippingPage() {
  await requireAdmin();
  const rules = await getShippingRules();
  const activeRule = rules[0];

  if (!activeRule) {
    notFound();
  }

  return <ShippingRuleForm rule={activeRule} />;
}
