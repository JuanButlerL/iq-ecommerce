"use client";

import { useState } from "react";
import { ProductColorTheme, type ProductImage } from "@prisma/client";

import { productFallbackImageMap } from "@/features/catalog/product-theme";
import { cn } from "@/lib/utils/cn";

type ProductGalleryProps = {
  images: ProductImage[];
  colorTheme: ProductColorTheme;
};

export function ProductGallery({ images, colorTheme }: ProductGalleryProps) {
  const [selected, setSelected] = useState(images[0] ?? null);
  const fallbackImage = productFallbackImageMap[colorTheme];
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const selectedIndex = selected ? images.findIndex((image) => image.id === selected.id) : -1;

  const goToIndex = (nextIndex: number) => {
    if (images.length === 0) {
      return;
    }

    const safeIndex = (nextIndex + images.length) % images.length;
    setSelected(images[safeIndex] ?? null);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null || images.length < 2) {
      setTouchStartX(null);
      return;
    }

    const touchEndX = event.changedTouches[0]?.clientX ?? null;

    if (touchEndX === null) {
      setTouchStartX(null);
      return;
    }

    const deltaX = touchEndX - touchStartX;

    if (Math.abs(deltaX) < 40) {
      setTouchStartX(null);
      return;
    }

    goToIndex(selectedIndex + (deltaX < 0 ? 1 : -1));
    setTouchStartX(null);
  };

  if (!selected) {
    return (
      <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-white p-4 shadow-card md:p-8">
        <img src={fallbackImage} alt="Producto" className="absolute inset-0 h-full w-full object-contain p-4 md:p-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-0">
      <div className="flex flex-col md:grid md:grid-cols-[104px_minmax(0,1fr)] md:items-start md:gap-5 lg:grid-cols-[120px_minmax(0,1fr)]">
        <div className="order-2 rounded-[1.5rem] bg-white/80 p-3 shadow-card md:order-1 md:rounded-none md:bg-transparent md:p-0 md:shadow-none">
          <div className="grid grid-cols-3 gap-3 md:grid-cols-1">
          {images.map((image) => (
            <button
              key={image.id}
              type="button"
              className={cn(
                "relative aspect-square overflow-hidden rounded-[1.25rem] border border-transparent bg-white p-2 shadow-card transition hover:border-brand-pink/30 md:rounded-[1.5rem] md:p-3",
                selected.id === image.id && "border-brand-pink/40 ring-2 ring-brand-pink/15",
              )}
              onClick={() => setSelected(image)}
            >
              <img
                src={image.publicUrl}
                alt={image.altText}
                className="absolute inset-0 h-full w-full object-contain p-2 md:p-4"
                onError={(event) => {
                  event.currentTarget.onerror = null;
                  event.currentTarget.src = fallbackImage;
                }}
              />
            </button>
          ))}
          </div>
        </div>
        <div
          className="order-1 mb-3 relative aspect-square overflow-hidden rounded-[2rem] bg-white p-4 shadow-card md:order-2 md:mb-0 md:p-8"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={selected.publicUrl}
            alt={selected.altText}
            className="absolute inset-0 h-full w-full object-contain p-4 md:p-8"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = fallbackImage;
            }}
          />
          {images.length > 1 ? (
            <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-2 md:hidden">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  aria-label={`Ver imagen ${index + 1}`}
                  className={cn(
                    "h-2.5 rounded-full transition-all",
                    selected.id === image.id ? "w-6 bg-brand-pink" : "w-2.5 bg-brand-ink/20",
                  )}
                  onClick={() => setSelected(image)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
