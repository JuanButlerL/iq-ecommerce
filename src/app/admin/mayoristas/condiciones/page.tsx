import { WholesaleSettingsForm } from "@/features/admin/components/wholesale-settings-form";
import { getStoreSettings } from "@/features/settings/queries";
import { getWholesaleSettings } from "@/features/wholesale/settings";
import { requireAdminSection } from "@/lib/auth/admin";

export default async function AdminWholesaleConditionsPage() {
  await requireAdminSection("wholesale");
  const [settings, storeSettings] = await Promise.all([getWholesaleSettings(), getStoreSettings()]);

  return (
    <WholesaleSettingsForm
      settings={settings}
      bankAccount={storeSettings ? { alias: storeSettings.bankAlias, cbu: storeSettings.bankCbu, holder: storeSettings.bankHolder } : null}
    />
  );
}
