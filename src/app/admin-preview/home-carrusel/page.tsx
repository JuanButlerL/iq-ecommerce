import type { Metadata } from "next";

import { HomeCarouselPreviewFrame } from "@/features/home-slides/components/home-carousel-preview-frame";
import { getStoreSettingsForClient } from "@/features/settings/queries";
import { buildWholesalePortadaSlide } from "@/features/wholesale/components/wholesale-portada";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { requireAdminSection } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Vista previa del carrusel",
  robots: { index: false, follow: false },
};

// Lives outside /admin so the admin shell doesn't wrap it; the path still starts with
// "/admin" so the site chrome, popups and session tracking stay off.
// ?canal=mayorista muestra el carrusel de /mayoristas (portada mayorista + slides).
export default async function HomeCarouselPreviewPage({ searchParams }: { searchParams: Promise<{ canal?: string }> }) {
  if ((await searchParams).canal === "mayorista") {
    await requireAdminSection("wholesale");
    const content = await getWholesaleContent();
    const portada = buildWholesalePortadaSlide({
      hero: content.hero,
      // Mismo criterio que /mayoristas para el botón "Ver precios": acá basta con que la sección esté prendida.
      showProducts: content.sections.products,
      hasMoreSlides: true,
    });

    return <HomeCarouselPreviewFrame footnote={null} intervalSeconds={content.hero.intervalSeconds} wholesalePortada={portada} />;
  }

  await requireAdminSection("home-carousel");
  const settings = await getStoreSettingsForClient();
  const footnote = settings?.subscriptionSectionEnabled ? settings.subscriptionHeroNote?.trim() || null : null;

  return <HomeCarouselPreviewFrame footnote={footnote} intervalSeconds={settings?.heroCarouselIntervalSeconds ?? 7} />;
}
