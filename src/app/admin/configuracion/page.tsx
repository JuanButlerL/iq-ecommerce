import { SettingsForm } from "@/features/admin/components/settings-form";
import { getShippingRules, getStoreSettings } from "@/features/settings/queries";
import { requireAdmin } from "@/lib/auth/admin";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [settings, shippingRules] = await Promise.all([getStoreSettings(), getShippingRules()]);

  if (!settings) {
    return null;
  }

  return <SettingsForm settings={settings} shippingRules={shippingRules} />;
}
