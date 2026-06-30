"use client";

import Link from "next/link";
import type { Product, ProductImage } from "@prisma/client";

import { productFallbackImageMap, resolveProductTheme } from "@/features/catalog/product-theme";
import { formatArs } from "@/lib/utils/currency";

type HomeProductCardProps = {
  product: Product & { images: ProductImage[] };
};

export function HomeProductCard({ product }: HomeProductCardProps) {
  const primaryImage = product.images.find((entry) => entry.isPrimary) ?? product.images[0];
  const theme = resolveProductTheme(product);
  const fallbackImage = productFallbackImageMap[product.colorTheme];

  return (
    <article className="flex flex-col items-center text-center">
      <div className="relative w-full max-w-[300px] overflow-hidden rounded-[2rem] bg-white shadow-[0_16px_40px_rgba(44,34,65,0.08)]">
        <Link href={`/productos/${product.slug}`} className="group block w-full">
          <div className="relative mx-auto aspect-[1/1.08] w-full overflow-hidden">
            {primaryImage ? (
              <img
                src={primaryImage.publicUrl}
                alt={primaryImage.altText}
                className="absolute inset-0 h-full w-full scale-[1.18] object-contain p-1 md:scale-[1.22] md:p-2"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = fallbackImage;
                }}
              />
            ) : (
              <img
                src={fallbackImage}
                alt={product.name}
                className="absolute inset-0 h-full w-full scale-[1.18] object-contain p-1 md:scale-[1.22] md:p-2"
              />
            )}
          </div>
        </Link>
      </div>

      <div className="mt-4 space-y-2 px-2">
        <Link href={`/productos/${product.slug}`} className="font-display text-xl leading-tight text-brand-ink md:text-2xl">
          {product.name}
        </Link>
        <p className="text-xl font-semibold text-brand-ink md:text-[17px]">{formatArs(product.priceArs)}</p>
        <Link
          href={`/productos/${product.slug}`}
          className="inline-flex items-center gap-1 text-lg font-medium md:text-[17px]"
          style={{ color: theme.accent }}
        >
          Comprar <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
