import { SettingsForm } from "@/features/admin/components/settings-form";
import { getShippingRules, getStoreSettings } from "@/features/settings/queries";
import { requireAdmin } from "@/lib/auth/admin";
import { notFound } from "next/navigation";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [settings, shippingRules] = await Promise.all([getStoreSettings(), getShippingRules()]);

  if (!settings) {
    notFound();
  }

  return <SettingsForm settings={settings} shippingRules={shippingRules} />;
}
