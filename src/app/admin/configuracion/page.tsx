import { SettingsForm } from "@/features/admin/components/settings-form";
import { getShippingRules, getStoreSettingsForClient } from "@/features/settings/queries";
import { requireAdmin } from "@/lib/auth/admin";
import { notFound } from "next/navigation";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [settings, shippingRules] = await Promise.all([getStoreSettingsForClient(), getShippingRules()]);

  if (!settings) {
    notFound();
  }

  return <SettingsForm settings={settings} shippingRules={shippingRules} />;
}
