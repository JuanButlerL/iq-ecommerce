"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product, ProductImage } from "@prisma/client";

import { productFallbackImageMap, productThemeMap } from "@/features/catalog/product-theme";
import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";

type HomeProductCardProps = {
  product: Product & { images: ProductImage[] };
};

export function HomeProductCard({ product }: HomeProductCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const images = product.images.length > 0 ? product.images : [];
  const theme = productThemeMap[product.colorTheme];
  const fallbackImage = productFallbackImageMap[product.colorTheme];

  useEffect(() => {
    if (!isHovering || images.length < 2) {
      setActiveIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, 900);

    return () => window.clearInterval(interval);
  }, [images.length, isHovering]);

  return (
    <article className="flex flex-col items-center text-center">
      <Link
        href={`/productos/${product.slug}`}
        className="group block w-full"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onFocus={() => setIsHovering(true)}
        onBlur={() => setIsHovering(false)}
      >
        <div className="relative mx-auto aspect-[1/1.08] w-full max-w-[300px] overflow-hidden rounded-[2rem] bg-white shadow-[0_16px_40px_rgba(44,34,65,0.08)]">
          {images.length > 0 ? (
            images.map((image, index) => (
              <img
                key={`${image.id}-${index}`}
                src={image.publicUrl}
                alt={image.altText}
                className={cn(
                  "absolute inset-0 h-full w-full scale-[1.18] object-contain p-1 transition-all duration-500 md:scale-[1.22] md:p-2",
                  index === activeIndex ? "opacity-100" : "opacity-0",
                )}
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = fallbackImage;
                }}
              />
            ))
          ) : (
            <img
              src={fallbackImage}
              alt={product.name}
              className="absolute inset-0 h-full w-full scale-[1.18] object-contain p-1 md:scale-[1.22] md:p-2"
            />
          )}

          {images.length > 1 ? (
            <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label={`Ver imagen ${index + 1} de ${product.name}`}
                  className={cn(
                    "h-2.5 rounded-full transition-all",
                    index === activeIndex ? "w-6" : "w-2.5 bg-brand-ink/20",
                  )}
                  style={index === activeIndex ? { backgroundColor: theme.accent } : undefined}
                  onMouseEnter={(event) => {
                    event.preventDefault();
                    setActiveIndex(index);
                  }}
                  onFocus={() => setActiveIndex(index)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </Link>

      <div className="mt-4 space-y-2 px-2">
        <Link href={`/productos/${product.slug}`} className="text-lg leading-snug text-brand-ink/70 md:text-[18px]">
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
