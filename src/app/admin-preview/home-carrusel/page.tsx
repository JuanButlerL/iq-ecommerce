import type { Metadata } from "next";

import { HomeCarouselPreviewFrame } from "@/features/home-slides/components/home-carousel-preview-frame";
import { getStoreSettingsForClient } from "@/features/settings/queries";
import { requireAdminSection } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Vista previa del carrusel",
  robots: { index: false, follow: false },
};

// Lives outside /admin so the admin shell doesn't wrap it; the path still starts with
// "/admin" so the site chrome, popups and session tracking stay off.
export default async function HomeCarouselPreviewPage() {
  await requireAdminSection("home-carousel");
  const settings = await getStoreSettingsForClient();
  const footnote = settings?.subscriptionSectionEnabled ? settings.subscriptionHeroNote?.trim() || null : null;

  return <HomeCarouselPreviewFrame footnote={footnote} intervalSeconds={settings?.heroCarouselIntervalSeconds ?? 7} />;
}
