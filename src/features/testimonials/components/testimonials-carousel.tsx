"use client";

import { Quote, Star } from "lucide-react";

type TestimonialItem = {
  id: string;
  name: string;
  roleLabel: string | null;
  quote: string;
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
  const shouldAutoscroll = testimonials.length > 3;
  const cardWidthClass = getCardWidthClass(testimonials.length);
  const marqueeTestimonials = shouldAutoscroll ? [...testimonials, ...testimonials] : testimonials;

  return (
    <div className="mt-10">
      <div className="mt-6 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-5 pr-4 lg:hidden">
        {testimonials.map((testimonial) => (
          <TestimonialCard key={testimonial.id} testimonial={testimonial} className={cardWidthClass} />
        ))}
      </div>

      {shouldAutoscroll ? (
        <div className="mt-6 hidden overflow-hidden lg:block [mask-image:linear-gradient(90deg,transparent,black_4%,black_96%,transparent)]">
          <div className="flex w-max gap-5 motion-safe:animate-[testimonials-marquee_34s_linear_infinite] motion-safe:hover:[animation-play-state:paused]">
            {marqueeTestimonials.map((testimonial, index) => (
              <TestimonialCard
                key={`${testimonial.id}-${index}`}
                testimonial={testimonial}
                className="w-[calc((100vw-8rem)/3)] max-w-[31rem] min-w-[25rem]"
                aria-hidden={index >= testimonials.length ? true : undefined}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 hidden gap-5 lg:flex">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} className={cardWidthClass} />
          ))}
        </div>
      )}
    </div>
  );
}

function TestimonialCard({
  testimonial,
  className,
  "aria-hidden": ariaHidden,
}: {
  testimonial: TestimonialItem;
  className: string;
  "aria-hidden"?: boolean;
}) {
  return (
    <article
      className={`relative shrink-0 snap-start overflow-hidden rounded-[2rem] border border-brand-ink/8 bg-white px-7 py-6 shadow-card ${className}`}
      aria-hidden={ariaHidden}
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
  );
}
