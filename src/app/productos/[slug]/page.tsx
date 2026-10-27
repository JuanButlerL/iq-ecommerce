import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MetaPixelEvent } from "@/components/analytics/meta-pixel-event";
import { TrackEventOnView } from "@/components/analytics/track-event-on-view";
import { Container } from "@/components/layout/container";
import { HomeInstitutionalStrip } from "@/features/catalog/components/home-institutional-strip";
import { ProductGallery } from "@/features/catalog/components/product-gallery";
import { ProductLongDescription } from "@/features/catalog/components/product-long-description";
import { ProductPurchasePanel } from "@/features/catalog/components/product-purchase-panel";
import { ProductCard } from "@/features/catalog/components/product-card";
import { ProductPrice } from "@/features/catalog/components/product-price";
import { getProductBySlug, getSimilarProducts } from "@/features/catalog/queries";
import { absoluteUrl, JsonLd } from "@/lib/seo/json-ld";
import { formatArs } from "@/lib/utils/currency";
import { siteConfig } from "@/lib/utils/site";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

function toPlainDescription(value: string, maxLength = 300) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product || !product.active || !product.visible) {
    return { robots: { index: false } };
  }

  const description = toPlainDescription(product.shortDescription, 160);
  const image = product.images.find((item) => item.isPrimary) ?? product.images[0];
  const images = image ? [{ url: image.publicUrl, alt: image.altText || product.name }] : undefined;

  return {
    title: product.name,
    description,
    alternates: { canonical: `/productos/${product.slug}` },
    openGraph: { title: `${product.name} | IQ Kids`, description, type: "website", url: `/productos/${product.slug}`, images },
    twitter: { card: image ? "summary_large_image" : "summary", title: product.name, description, images: image ? [image.publicUrl] : undefined },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product || !product.active || !product.visible) {
    notFound();
  }

  const similarProducts = await getSimilarProducts(product.id);
  const productUrl = absoluteUrl(`/productos/${product.slug}`);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: toPlainDescription(product.shortDescription),
    image: product.images.map((image) => absoluteUrl(image.publicUrl)),
    url: productUrl,
    brand: { "@type": "Brand", name: siteConfig.name },
    manufacturer: { "@type": "Organization", name: siteConfig.companyName },
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "ARS",
      price: product.priceArs,
      ...(product.activeDiscountPercentage && product.discountEndsAt
        ? { priceValidUntil: product.discountEndsAt.toISOString().slice(0, 10) }
        : {}),
      availability: product.manualSoldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: siteConfig.name },
    },
  };

  return (
    <Container className="space-y-14 py-12 md:py-16">
      <JsonLd data={structuredData} />
      <MetaPixelEvent
        eventName="ViewContent"
        dedupeKey={`view-content:${product.id}`}
        params={{
          content_ids: [product.id],
          content_name: product.name,
          content_type: "product",
          currency: "ARS",
          value: product.priceArs,
        }}
      />
      <TrackEventOnView
        eventName="view_item"
        params={{
          currency: "ARS",
          value: product.priceArs,
          items: [
            {
              item_id: product.id,
              item_name: product.name,
              item_category: "Productos",
              price: product.priceArs,
              quantity: 1,
            },
          ],
        }}
      />
      <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr]">
        <ProductGallery images={product.images} colorTheme={product.colorTheme} />
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Nuestras Barritas</p>
            <h1 className="font-display text-3xl leading-none text-brand-ink md:text-5xl">{product.name}</h1>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-card">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Precio</p>
            <p className="mt-2 text-3xl font-extrabold text-brand-pink md:text-4xl">
              <ProductPrice
                priceArs={product.priceArs}
                listPriceArs={product.listPriceArs}
                discountPercentage={product.activeDiscountPercentage}
              />
            </p>
            {product.listPriceArs ? (
              <p className="mt-2 text-sm font-bold text-emerald-700">
                Ahorrás {formatArs(product.listPriceArs - product.priceArs)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 border-t border-brand-ink/10 pt-4">
            {product.shortDescription
              .replace(/\r\n/g, "\n")
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => (
                <p key={line} className="text-base leading-7 text-brand-ink/76 md:text-lg md:leading-8">
                  {line}
                </p>
              ))}
          </div>

          <ProductLongDescription content={product.longDescription} />

          <ProductPurchasePanel productId={product.id} productName={product.name} priceArs={product.priceArs} />
        </div>
      </div>

      <section className="space-y-6">
        <h2 className="font-display text-3xl text-brand-ink md:text-4xl">Productos similares</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {similarProducts.map((similarProduct) => (
            <ProductCard key={similarProduct.id} product={similarProduct} />
          ))}
        </div>
      </section>

      <HomeInstitutionalStrip />
    </Container>
  );
}
