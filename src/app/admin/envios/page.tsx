import { ShippingRuleForm } from "@/features/admin/components/shipping-rule-form";
import { getShippingRules } from "@/features/settings/queries";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminShippingPage() {
  await requireAdmin();
  const rules = await getShippingRules();
  const activeRule = rules[0];

  if (!activeRule) {
    return null;
  }

  return <ShippingRuleForm rule={activeRule} />;
}
