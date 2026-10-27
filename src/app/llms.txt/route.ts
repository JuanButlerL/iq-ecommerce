import { getVisibleProducts } from "@/features/catalog/queries";
import { getPublishedFaqs } from "@/features/faq/queries";
import { getNewsletterSitemapEntries } from "@/features/newsletter/queries";
import { getStoreSettings } from "@/features/settings/queries";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { absoluteUrl } from "@/lib/seo/json-ld";
import { getSiteLastUpdatedAt } from "@/lib/seo/last-updated";
import { formatArs } from "@/lib/utils/currency";
import { getArgentinaDateKey } from "@/lib/utils/datetime";
import { siteConfig } from "@/lib/utils/site";

// llms.txt (https://llmstxt.org): a plain summary of the store for AI engines,
// built per request from the same DB data as the site and the sitemap.
export const dynamic = "force-dynamic";

function singleLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sentence(value: string) {
  const text = singleLine(value);
  return !text || /[.!?]$/.test(text) ? text : `${text}.`;
}

export async function GET() {
  const [products, settings, faqs, newsletters, wholesale, lastUpdatedAt] = await Promise.all([
    getVisibleProducts(),
    getStoreSettings(),
    getPublishedFaqs(),
    getNewsletterSitemapEntries(),
    getWholesaleContent(),
    getSiteLastUpdatedAt(),
  ]);

  const lines = [
    `# ${siteConfig.name}`,
    "",
    `> ${siteConfig.description}`,
    "",
    `${siteConfig.name} es una marca de ${siteConfig.companyName}. Este es su sitio oficial: ${absoluteUrl("/")}`,
  ];

  if (lastUpdatedAt) {
    lines.push(`Última actualización: ${getArgentinaDateKey(lastUpdatedAt)}`);
  }

  if (products.length > 0) {
    lines.push("", "## Productos", "");
    for (const product of products) {
      const price = product.listPriceArs
        ? `${formatArs(product.priceArs)} (antes ${formatArs(product.listPriceArs)}, ${product.activeDiscountPercentage}% off)`
        : formatArs(product.priceArs);
      const stock = product.manualSoldOut ? " Sin stock por el momento." : "";
      lines.push(`- [${product.name}](${absoluteUrl(`/productos/${product.slug}`)}): ${sentence(product.shortDescription)} Precio: ${price}.${stock}`);
    }
  }

  if (settings) {
    const shipping: string[] = [];
    if (settings.freeShippingThreshold > 0) {
      shipping.push(`- Envío gratis en compras desde ${formatArs(settings.freeShippingThreshold)}.`);
    }
    const discountThreshold = settings.activeShippingRule?.discountThresholdArs;
    const discountPercentage = settings.activeShippingRule?.discountPercentage;
    if (discountThreshold && discountPercentage) {
      shipping.push(`- ${discountPercentage}% de descuento en el envío desde ${formatArs(discountThreshold)}.`);
    }
    if (settings.minimumOrderAmount > 0) {
      shipping.push(`- Compra mínima: ${formatArs(settings.minimumOrderAmount)}.`);
    }
    if (shipping.length > 0) {
      lines.push("", "## Envíos", "", ...shipping);
    }
  }

  if (settings?.faqSectionEnabled && faqs.length > 0) {
    lines.push("", "## Preguntas frecuentes", "");
    for (const faq of faqs) {
      lines.push(`### ${singleLine(faq.question)}`, "", faq.answer.trim(), "");
    }
    lines.pop();
  }

  const pages = [`- [Productos](${absoluteUrl("/productos")})`];
  if (settings?.faqSectionEnabled) pages.push(`- [Preguntas frecuentes](${absoluteUrl("/preguntas-frecuentes")})`);
  if (newsletters.length > 0) pages.push(`- [Newsletter](${absoluteUrl("/newsletter")}): recetas, tips de nutrición y novedades`);
  // Same rule as the sitemap: only list the wholesale page when it's public.
  if (wholesale.enabled && !wholesale.accessPasswordHash) pages.push(`- [Venta mayorista](${absoluteUrl("/mayoristas")})`);
  pages.push(`- [Contacto](${absoluteUrl("/contacto")})`);
  lines.push("", "## Más información", "", ...pages);

  const contact: string[] = [];
  if (settings?.contactEmail) contact.push(`- Email: ${settings.contactEmail}`);
  if (settings?.instagramUrl) contact.push(`- Instagram: ${settings.instagramUrl}`);
  if (contact.length > 0) {
    lines.push("", "## Contacto", "", ...contact);
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
