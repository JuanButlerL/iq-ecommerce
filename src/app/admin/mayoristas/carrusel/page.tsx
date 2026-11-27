import { HomeSlidesAdminPanel } from "@/features/admin/components/home-slides-admin-panel";
import { getAdminHomeSlides } from "@/features/home-slides/queries";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { requireAdminSection } from "@/lib/auth/admin";

// Mismo admin que Minorista > Home carrusel, para los slides que pasan después de la portada de /mayoristas.
export default async function AdminWholesaleCarouselPage() {
  await requireAdminSection("wholesale");
  const [slides, content] = await Promise.all([getAdminHomeSlides("WHOLESALE"), getWholesaleContent()]);

  return <HomeSlidesAdminPanel slides={slides} intervalSeconds={content.hero.intervalSeconds} channel="WHOLESALE" />;
}
