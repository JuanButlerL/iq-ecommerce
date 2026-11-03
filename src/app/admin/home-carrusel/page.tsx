import { HomeSlidesAdminPanel } from "@/features/admin/components/home-slides-admin-panel";
import { getAdminHomeSlides } from "@/features/home-slides/queries";
import { getStoreSettings } from "@/features/settings/queries";
import { requireAdminSection } from "@/lib/auth/admin";

export default async function AdminHomeCarouselPage() {
  await requireAdminSection("home-carousel");
  const [slides, settings] = await Promise.all([getAdminHomeSlides(), getStoreSettings()]);

  return <HomeSlidesAdminPanel slides={slides} intervalSeconds={settings?.heroCarouselIntervalSeconds ?? 7} />;
}
