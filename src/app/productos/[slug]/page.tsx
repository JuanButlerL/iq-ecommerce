import { notFound } from "next/navigation";

import { MetaPixelEvent } from "@/components/analytics/meta-pixel-event";
import { TrackEventOnView } from "@/components/analytics/track-event-on-view";
import { Container } from "@/components/layout/container";
import { HomeInstitutionalStrip } from "@/features/catalog/components/home-institutional-strip";
import { ProductGallery } from "@/features/catalog/components/product-gallery";
import { ProductLongDescription } from "@/features/catalog/components/product-long-description";
import { ProductPurchasePanel } from "@/features/catalog/components/product-purchase-panel";
import { ProductCard } from "@/features/catalog/components/product-card";
import { getProductBySlug, getSimilarProducts } from "@/features/catalog/queries";
import { formatArs } from "@/lib/utils/currency";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product || !product.active || !product.visible) {
    notFound();
  }

  const similarProducts = await getSimilarProducts(product.id);

  return (
    <Container className="space-y-14 py-12 md:py-16">
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
            <p className="mt-2 text-3xl font-extrabold text-brand-pink md:text-4xl">{formatArs(product.priceArs)}</p>
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
