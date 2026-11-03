import { WholesaleAdminPanel } from "@/features/admin/components/wholesale-admin-panel";
import { getStoreSettings } from "@/features/settings/queries";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { requireAdminSection } from "@/lib/auth/admin";

export default async function AdminWholesalePage() {
  await requireAdminSection("wholesale");
  const [content, settings] = await Promise.all([getWholesaleContent(), getStoreSettings()]);

  return (
    <WholesaleAdminPanel
      content={{ ...content, accessPasswordHash: "" }}
      hasAccessPassword={Boolean(content.accessPasswordHash)}
      storeWhatsapp={settings?.whatsappNumber ?? null}
      sectionId="general"
    />
  );
}
