import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MetaPixelEvent } from "@/components/analytics/meta-pixel-event";
import { Container } from "@/components/layout/container";
import { ProductPrice } from "@/features/catalog/components/product-price";
import { hasWholesaleAccess } from "@/features/wholesale/access";
import { WholesaleOrderBar, WholesaleProductGrid } from "@/features/wholesale/components/wholesale-product-grid";
import { WholesalePurchasePanel } from "@/features/wholesale/components/wholesale-purchase-panel";
import { getPublicWholesaleProducts } from "@/features/wholesale/products";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { getWholesaleSettings } from "@/features/wholesale/settings";
import { WHOLESALE_META_CHANNEL, WHOLESALE_META_EVENTS } from "@/lib/wholesale-meta-events";
import { formatArs } from "@/lib/utils/currency";

export const metadata: Metadata = {
  title: "Producto mayorista",
  robots: { index: false, follow: false },
};

export default async function WholesaleProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const content = await getWholesaleContent();

  if (!content.enabled) {
    notFound();
  }

  if (!(await hasWholesaleAccess(content))) {
    redirect("/mayoristas");
  }

  const [wholesaleProducts, settings] = await Promise.all([getPublicWholesaleProducts(), getWholesaleSettings()]);
  const products = wholesaleProducts.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    priceArs: product.priceArs,
    unitsPerDisplay: product.unitsPerDisplay,
    soldOut: product.soldOut,
  }));
  const product = products.find((item) => item.id === id);

  if (!product) {
    notFound();
  }

  const others = products.filter((item) => item.id !== product.id);
  const unitPrice = formatArs(Math.round(product.priceArs / Math.max(1, product.unitsPerDisplay)));

  return (
    <Container className="space-y-14 py-12 md:py-16">
      <MetaPixelEvent
        custom
        eventName={WHOLESALE_META_EVENTS.viewContent}
        dedupeKey={`view-content-mayorista:${product.id}`}
        params={{
          content_ids: [product.id],
          content_name: product.name,
          content_type: "product",
          currency: "ARS",
          value: product.priceArs,
          channel: WHOLESALE_META_CHANNEL,
        }}
      />
      <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-white shadow-card">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- misma imagen que la tarjeta del listado.
            <img src={product.imageUrl} alt={product.imageAlt || product.name} className="absolute inset-0 h-full w-full object-contain" />
          ) : null}
        </div>
        <div className="space-y-6">
          <div className="space-y-3">
            <Link href="/mayoristas#productos" className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">
              iQ Kids Mayoristas
            </Link>
            <h1 className="font-display text-3xl leading-none text-brand-ink md:text-5xl">{product.name}</h1>
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-card">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Precio por display</p>
            <p className="mt-2 text-3xl font-extrabold text-brand-pink md:text-4xl">
              <ProductPrice priceArs={product.priceArs} />
            </p>
            <p className="mt-2 text-sm font-bold text-brand-ink/60">
              {product.unitsPerDisplay} barritas · {unitPrice} por unidad · IVA incluido
            </p>
          </div>

          {product.description ? (
            <div className="space-y-2 border-t border-brand-ink/10 pt-4">
              {product.description
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => (
                  <p key={line} className="text-base leading-7 text-brand-ink/76 md:text-lg md:leading-8">
                    {line}
                  </p>
                ))}
            </div>
          ) : null}

          <p className="text-sm font-bold text-brand-ink/60">
            Pedido mínimo: {settings.minDisplays} display{settings.minDisplays === 1 ? "" : "s"} en total, podés combinar sabores.
          </p>

          {product.soldOut ? (
            <p className="flex h-12 items-center justify-center rounded-full bg-brand-ink/5 text-sm font-extrabold text-brand-ink/50">Sin stock. Volvé pronto.</p>
          ) : (
            <WholesalePurchasePanel productId={product.id} productName={product.name} priceArs={product.priceArs} />
          )}
        </div>
      </div>

      {others.length > 0 ? (
        <section className="space-y-6">
          <h2 className="font-display text-3xl text-brand-ink md:text-4xl">Otros productos</h2>
          <WholesaleProductGrid products={others} minDisplays={settings.minDisplays} />
        </section>
      ) : null}

      <WholesaleOrderBar products={products} minDisplays={settings.minDisplays} />
    </Container>
  );
}
