import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { HomeInstitutionalStrip } from "@/features/catalog/components/home-institutional-strip";
import { ProductGallery } from "@/features/catalog/components/product-gallery";
import { ProductPurchasePanel } from "@/features/catalog/components/product-purchase-panel";
import { ProductCard } from "@/features/catalog/components/product-card";
import { getProductBySlug, getSimilarProducts } from "@/features/catalog/queries";

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
      <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr]">
        <ProductGallery images={product.images} />
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Nuestras Barritas</p>
            <h1 className="font-display text-3xl leading-none text-brand-ink md:text-5xl">{product.name}</h1>
            <p className="text-base leading-7 text-brand-ink/75 md:text-lg">{product.shortDescription}</p>
            <p className="text-sm leading-7 text-brand-ink/70 md:text-base">{product.longDescription}</p>
          </div>
          <ProductPurchasePanel productId={product.id} priceArs={product.priceArs} />
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
