import { notFound } from "next/navigation";

import { WholesaleAdminPanel } from "@/features/admin/components/wholesale-admin-panel";
import { getStoreSettings } from "@/features/settings/queries";
import { getWholesaleAdminSection } from "@/features/wholesale/admin-sections";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { requireAdminSection } from "@/lib/auth/admin";

export default async function AdminWholesaleSectionPage({ params }: { params: Promise<{ seccion: string }> }) {
  await requireAdminSection("wholesale");
  const { seccion } = await params;
  const section = getWholesaleAdminSection(seccion);

  // "general" vive en /admin/mayoristas.
  if (!section || section.id === "general") {
    notFound();
  }

  const [content, settings] = await Promise.all([getWholesaleContent(), getStoreSettings()]);

  return (
    <WholesaleAdminPanel
      key={section.id}
      content={{ ...content, accessPasswordHash: "" }}
      hasAccessPassword={Boolean(content.accessPasswordHash)}
      storeWhatsapp={settings?.whatsappNumber ?? null}
      sectionId={section.id}
    />
  );
}
