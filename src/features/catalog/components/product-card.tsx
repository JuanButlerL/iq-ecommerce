"use client";

import Link from "next/link";
import type { Product, ProductImage } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { productFallbackImageMap, productThemeMap } from "@/features/catalog/product-theme";
import { formatArs } from "@/lib/utils/currency";

type ProductCardProps = {
  product: Product & { images: ProductImage[] };
};

export function ProductCard({ product }: ProductCardProps) {
  const image = product.images[0];
  const theme = productThemeMap[product.colorTheme];
  const fallbackImage = productFallbackImageMap[product.colorTheme];

  return (
    <Card className="overflow-hidden">
      <div className="relative h-80 bg-white p-6">
        {image ? (
          <img
            src={image.publicUrl}
            alt={image.altText}
            className="absolute inset-0 h-full w-full object-contain p-0 scale-[1.16]"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = fallbackImage;
            }}
          />
        ) : (
          <img src={fallbackImage} alt={product.name} className="absolute inset-0 h-full w-full object-contain p-0 scale-[1.16]" />
        )}
      </div>

      <div className="space-y-4 p-6">
        <div
          className="inline-flex rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em]"
          style={{ backgroundColor: `${theme.accent}14`, color: theme.accent }}
        >
          Nuestras Barritas
        </div>

        <div>
          <h3 className="text-xl font-extrabold text-brand-ink">{product.name}</h3>
          <p className="mt-2 line-clamp-2 text-sm text-brand-ink/70">{product.shortDescription}</p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="font-display text-3xl text-brand-ink">{formatArs(product.priceArs)}</p>
          <Link href={`/productos/${product.slug}`}>
            <Button size="sm">Comprar</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}
