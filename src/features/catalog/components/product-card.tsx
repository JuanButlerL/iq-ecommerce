"use client";

import Link from "next/link";
import type { Product, ProductImage } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { productFallbackImageMap, resolveProductTheme } from "@/features/catalog/product-theme";
import { formatArs } from "@/lib/utils/currency";

type ProductCardProps = {
  product: Product & { images: ProductImage[] };
};

export function ProductCard({ product }: ProductCardProps) {
  const image = product.images.find((entry) => entry.isPrimary) ?? product.images[0];
  const theme = resolveProductTheme(product);
  const fallbackImage = productFallbackImageMap[product.colorTheme];

  return (
    <Card className="overflow-hidden">
      <Link
        href={`/productos/${product.slug}`}
        className="group relative block h-80 bg-white p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink focus-visible:ring-inset"
        aria-label={`Ver detalle de ${product.name}`}
      >
        {image ? (
          <img
            src={image.publicUrl}
            alt={image.altText}
            className="absolute inset-0 h-full w-full scale-[1.14] object-contain p-2 transition-transform duration-300 group-hover:scale-[1.18] md:scale-[1.18] md:p-3 md:group-hover:scale-[1.22]"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = fallbackImage;
            }}
          />
        ) : (
          <img
            src={fallbackImage}
            alt={product.name}
            className="absolute inset-0 h-full w-full scale-[1.14] object-contain p-2 transition-transform duration-300 group-hover:scale-[1.18] md:scale-[1.18] md:p-3 md:group-hover:scale-[1.22]"
          />
        )}
      </Link>

      <div className="space-y-4 p-6">
        <div
          className="inline-flex rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em]"
          style={{ backgroundColor: `${theme.accent}14`, color: theme.accent }}
        >
          Nuestras Barritas
        </div>

        <div>
          <h3>
            <Link
              href={`/productos/${product.slug}`}
              className="font-display text-2xl leading-tight text-brand-ink transition-colors hover:text-brand-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-pink/50"
            >
              {product.name}
            </Link>
          </h3>
          <p className="mt-2 line-clamp-2 text-sm text-brand-ink/70">{product.shortDescription}</p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-2xl font-extrabold text-brand-ink">{formatArs(product.priceArs)}</p>
          <Link href={`/productos/${product.slug}`}>
            <Button size="sm">Comprar</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
