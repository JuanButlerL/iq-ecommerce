import type { MetadataRoute } from "next";

import { getVisibleProducts } from "@/features/catalog/queries";
import { getNewsletterSitemapEntries } from "@/features/newsletter/queries";
import { getStoreSettings } from "@/features/settings/queries";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { absoluteUrl } from "@/lib/seo/json-ld";

// Built per request: products, FAQ, newsletters and the wholesale page come from the DB.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, settings, newsletters, wholesale] = await Promise.all([
    getVisibleProducts(),
    getStoreSettings(),
    getNewsletterSitemapEntries(),
    getWholesaleContent(),
  ]);

  const latestProductUpdate = products.reduce<Date | undefined>(
    (latest, product) => (!latest || product.updatedAt > latest ? product.updatedAt : latest),
    undefined,
  );

  const entries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: latestProductUpdate, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/productos"), lastModified: latestProductUpdate, changeFrequency: "weekly", priority: 0.9 },
    ...products.map((product) => ({
      url: absoluteUrl(`/productos/${product.slug}`),
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    { url: absoluteUrl("/contacto"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/privacidad"), changeFrequency: "yearly", priority: 0.1 },
  ];

  if (settings?.faqSectionEnabled) {
    entries.push({ url: absoluteUrl("/preguntas-frecuentes"), lastModified: settings.updatedAt, changeFrequency: "monthly", priority: 0.7 });
  }

  if (newsletters.length > 0) {
    entries.push(
      { url: absoluteUrl("/newsletter"), lastModified: newsletters[0].updatedAt, changeFrequency: "weekly", priority: 0.6 },
      ...newsletters.map((newsletter) => ({
        url: absoluteUrl(`/newsletter/${newsletter.slug}`),
        lastModified: newsletter.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
    );
  }

  // Same rule as the page's robots metadata: only index it when it's public.
  if (wholesale.enabled && !wholesale.accessPasswordHash) {
    entries.push({ url: absoluteUrl("/mayoristas"), changeFrequency: "monthly", priority: 0.5 });
  }

  return entries;
}
