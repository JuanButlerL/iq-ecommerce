"use client";

import { useEffect, useMemo, useRef } from "react";
import { Quote, Star } from "lucide-react";

type TestimonialItem = {
  id: string;
  name: string;
  roleLabel: string | null;
  quote: string;
  avatarLabel: string | null;
};

type TestimonialsCarouselProps = {
  testimonials: TestimonialItem[];
};

function getCardWidthClass(count: number) {
  if (count <= 1) {
    return "w-full";
  }

  if (count === 2) {
    return "w-[88%] sm:w-[72%] lg:w-[calc(50%-0.75rem)]";
  }

  return "w-[88%] sm:w-[72%] lg:w-[calc(50%-0.75rem)] xl:w-[calc(33.333%-1rem)]";
}

export function TestimonialsCarousel({ testimonials }: TestimonialsCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoscroll = testimonials.length > 3;

  const cardWidthClass = useMemo(() => getCardWidthClass(testimonials.length), [testimonials.length]);
  const visibleTestimonials = useMemo(
    () => (shouldAutoscroll ? [...testimonials, ...testimonials] : testimonials),
    [shouldAutoscroll, testimonials],
  );

  useEffect(() => {
    const node = trackRef.current;

    if (!node || !shouldAutoscroll) {
      return;
    }

    let frameId = 0;
    let isPaused = false;
    let lastTimestamp = 0;
    const speed = 0.055;

    const animate = (timestamp: number) => {
      if (!lastTimestamp) {
        lastTimestamp = timestamp;
      }

      const elapsed = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      if (!isPaused) {
        node.scrollLeft += elapsed * speed;

        if (node.scrollLeft >= node.scrollWidth / 2) {
          node.scrollLeft = 0;
        }
      }

      frameId = window.requestAnimationFrame(animate);
    };

    const pause = () => {
      isPaused = true;
    };

    const resume = () => {
      isPaused = false;
    };

    frameId = window.requestAnimationFrame(animate);
    node.addEventListener("mouseenter", pause);
    node.addEventListener("mouseleave", resume);
    node.addEventListener("touchstart", pause, { passive: true });
    node.addEventListener("touchend", resume);

    return () => {
      window.cancelAnimationFrame(frameId);
      node.removeEventListener("mouseenter", pause);
      node.removeEventListener("mouseleave", resume);
      node.removeEventListener("touchstart", pause);
      node.removeEventListener("touchend", resume);
    };
  }, [shouldAutoscroll]);

  return (
    <div className="mt-10">
      {shouldAutoscroll ? (
        <div className="mb-4 flex justify-end">
          <span className="rounded-full bg-white/85 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-ink/55 shadow-card">
            Se mueve solo
          </span>
        </div>
      ) : null}

      <div ref={trackRef} className="mt-6 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-5 pr-4">
        {visibleTestimonials.map((testimonial, index) => (
          <article
            key={`${testimonial.id}-${index}`}
            className={`relative shrink-0 snap-start overflow-hidden rounded-[2rem] border border-brand-ink/8 bg-white px-7 py-6 shadow-card ${cardWidthClass}`}
            aria-hidden={shouldAutoscroll && index >= testimonials.length ? true : undefined}
          >
            <div className="absolute inset-x-0 top-0 h-1.5 bg-brand-pink" />
            <div className="absolute right-6 top-6 rounded-full bg-brand-pink/8 p-3 text-brand-pink">
              <Quote className="h-5 w-5" strokeWidth={2.1} />
            </div>

            <div className="pr-16">
              <h3 className="font-display text-[2rem] leading-none text-brand-ink">{testimonial.name}</h3>
              {testimonial.roleLabel ? (
                <p className="mt-2 max-w-[90%] text-sm font-semibold uppercase tracking-[0.18em] leading-7 text-brand-ink/52">
                  {testimonial.roleLabel}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex items-center gap-1 text-brand-yellow">
              {Array.from({ length: 5 }).map((_, starIndex) => (
                <Star key={`${testimonial.id}-${starIndex}`} className="h-4 w-4 fill-current" strokeWidth={1.8} />
              ))}
            </div>

            <p className="mt-4 text-[1.02rem] leading-7 text-brand-ink/84">&ldquo;{testimonial.quote}&rdquo;</p>
          </article>
        ))}
      </div>
    </div>
  );
}
