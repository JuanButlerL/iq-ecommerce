"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const touchStartXRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);
  const shouldBlockNavigationRef = useRef(false);

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

  const goToIndex = (nextIndex: number) => {
    if (images.length === 0) {
      return;
    }

    const safeIndex = (nextIndex + images.length) % images.length;
    setActiveIndex(safeIndex);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchCurrentXRef.current = touchStartXRef.current;
    shouldBlockNavigationRef.current = false;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null) {
      return;
    }

    touchCurrentXRef.current = event.touches[0]?.clientX ?? touchCurrentXRef.current;

    if (touchCurrentXRef.current === null) {
      return;
    }

    shouldBlockNavigationRef.current = Math.abs(touchCurrentXRef.current - touchStartXRef.current) > 12;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null || touchCurrentXRef.current === null || images.length < 2) {
      touchStartXRef.current = null;
      touchCurrentXRef.current = null;
      return;
    }

    const deltaX = touchCurrentXRef.current - touchStartXRef.current;

    if (Math.abs(deltaX) >= 40) {
      goToIndex(activeIndex + (deltaX < 0 ? 1 : -1));
      shouldBlockNavigationRef.current = true;
    }

    touchStartXRef.current = null;
    touchCurrentXRef.current = null;
  };

  return (
    <article className="flex flex-col items-center text-center">
      <div className="relative w-full max-w-[300px] overflow-hidden rounded-[2rem] bg-white shadow-[0_16px_40px_rgba(44,34,65,0.08)]">
        <Link
          href={`/productos/${product.slug}`}
          className="group block w-full"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onFocus={() => setIsHovering(true)}
          onBlur={() => setIsHovering(false)}
          onClickCapture={(event) => {
            if (!shouldBlockNavigationRef.current) {
              return;
            }

            event.preventDefault();
            shouldBlockNavigationRef.current = false;
          }}
        >
          <div
            className="relative mx-auto aspect-[1/1.08] w-full overflow-hidden [touch-action:pan-y]"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
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
          </div>
        </Link>

        {images.length > 1 ? (
          <>
            <div className="absolute inset-x-0 bottom-4 hidden items-center justify-center gap-2 md:flex">
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
                  onClick={() => goToIndex(index)}
                  onMouseEnter={(event) => {
                    event.preventDefault();
                    goToIndex(index);
                  }}
                  onFocus={() => goToIndex(index)}
                />
              ))}
            </div>

            <div className="border-t border-brand-ink/6 px-4 py-3 md:hidden">
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  aria-label={`Ver imagen anterior de ${product.name}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-ink/[0.06] text-base text-brand-ink transition active:scale-95"
                  onClick={() => goToIndex(activeIndex - 1)}
                >
                  {"<"}
                </button>
                <div className="flex items-center justify-center gap-2">
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
                      onClick={() => goToIndex(index)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  aria-label={`Ver siguiente imagen de ${product.name}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-ink/[0.06] text-base text-brand-ink transition active:scale-95"
                  onClick={() => goToIndex(activeIndex + 1)}
                >
                  {">"}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

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
