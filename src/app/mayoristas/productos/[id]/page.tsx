import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { MetaPixelEvent } from "@/components/analytics/meta-pixel-event";
import { Container } from "@/components/layout/container";
import { ProductPrice } from "@/features/catalog/components/product-price";
import { hasWholesaleAccess } from "@/features/wholesale/access";
import { WholesaleOrderBar, WholesaleProductGrid } from "@/features/wholesale/components/wholesale-product-grid";
import { WholesalePurchasePanel } from "@/features/wholesale/components/wholesale-purchase-panel";
import { saleUnitLabel, shortProductName } from "@/features/wholesale/bundles";
import { WholesaleBoxBuilder } from "@/features/wholesale/components/wholesale-box-builder";
import { getPublicWholesaleProducts, toWholesaleSaleProduct } from "@/features/wholesale/products";
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
  const products = wholesaleProducts.map(toWholesaleSaleProduct);
  const product = products.find((item) => item.id === id);

  if (!product) {
    notFound();
  }

  const others = products.filter((item) => item.id !== product.id);
  const unitPrice = formatArs(Math.round(product.priceArs / Math.max(1, product.unitsPerDisplay * product.displays)));
  const isSingle = product.kind === "FIXED" && product.displays === 1;
  const priceTitle = product.kind === "CUSTOM" ? "Precio por caja" : isSingle ? "Precio por display" : "Precio por bulto";

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
            {isSingle ? null : <p className="text-sm font-extrabold uppercase tracking-[0.16em] text-brand-ink/55">{saleUnitLabel(product)}</p>}
          </div>

          <div className="rounded-[2rem] bg-white p-5 shadow-card">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">{priceTitle}</p>
            <p className="mt-2 text-3xl font-extrabold text-brand-pink md:text-4xl">
              <ProductPrice priceArs={product.priceArs} />
            </p>
            <p className="mt-2 text-sm font-bold text-brand-ink/60">
              {isSingle
                ? `${product.unitsPerDisplay} barritas · ${unitPrice} por unidad · IVA incluido`
                : `${product.displays} displays · ${product.displays * product.unitsPerDisplay} barritas · ${formatArs(Math.round(product.priceArs / product.displays))} por display · IVA incluido`}
            </p>
            {product.kind === "FIXED" && !isSingle ? (
              <div className="mt-4 border-t border-brand-ink/10 pt-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-brand-ink/50">Qué trae cada bulto</p>
                <ul className="mt-2 grid gap-1.5 text-sm text-brand-ink">
                  {product.components.map((component) => (
                    <li key={component.productId} className="flex justify-between gap-3">
                      <span>{shortProductName(component.name)}</span>
                      <span className="font-extrabold tabular-nums">
                        {component.quantity} display{component.quantity === 1 ? "" : "s"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
            Pedido mínimo: {settings.minDisplays} display{settings.minDisplays === 1 ? "" : "s"} en total, podés combinar productos.
          </p>

          {product.soldOut ? (
            <p className="flex h-12 items-center justify-center rounded-full bg-brand-ink/5 text-sm font-extrabold text-brand-ink/50">Sin stock. Volvé pronto.</p>
          ) : product.kind === "CUSTOM" ? (
            <WholesaleBoxBuilder product={product} />
          ) : (
            <WholesalePurchasePanel productId={product.id} productName={product.name} priceArs={product.priceArs} unitLabel={isSingle ? "displays" : "bultos"} />
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
