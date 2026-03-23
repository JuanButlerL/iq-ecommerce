"use client";

import { useState } from "react";
import Image from "next/image";
import type { ProductImage } from "@prisma/client";

import { cn } from "@/lib/utils/cn";

type ProductGalleryProps = {
  images: ProductImage[];
};

export function ProductGallery({ images }: ProductGalleryProps) {
  const [selected, setSelected] = useState(images[0] ?? null);

  if (!selected) {
    return null;
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
              <Image src={image.publicUrl} alt={image.altText} fill className="object-contain p-2 md:p-4" sizes="120px" />
            </button>
          ))}
          </div>
        </div>
        <div className="order-1 mb-3 relative aspect-square overflow-hidden rounded-[2rem] bg-white p-4 shadow-card md:order-2 md:mb-0 md:p-8">
          <Image
            src={selected.publicUrl}
            alt={selected.altText}
            fill
            className="object-contain p-4 md:p-8"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        </div>
      </div>
    </div>
  );
}
