import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { hasWholesaleAccess } from "@/features/wholesale/access";
import { WholesaleContact } from "@/features/wholesale/components/wholesale-contact";
import { WholesalePasswordGate } from "@/features/wholesale/components/wholesale-password-gate";
import type { WholesaleSectionIntro } from "@/features/wholesale/content";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { getStoreSettings } from "@/features/settings/queries";
import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";

const FALLBACK_WHATSAPP = "5491173933235";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getWholesaleContent();

  return {
    title: content.seoTitle,
    description: content.seoDescription || undefined,
    alternates: { canonical: "/mayoristas" },
    robots: content.enabled && !content.accessPasswordHash ? undefined : { index: false, follow: false },
  };
}

const primaryCta =
  "inline-flex items-center justify-center rounded-full bg-brand-pink px-7 py-4 text-base font-extrabold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#ea737d]";
const secondaryCta =
  "inline-flex items-center justify-center rounded-full bg-white px-7 py-4 text-base font-extrabold text-brand-ink ring-2 ring-brand-ink/10 transition hover:ring-brand-ink/30";

function SectionHeading({ intro, center, dark }: { intro: WholesaleSectionIntro; center?: boolean; dark?: boolean }) {
  return (
    <div className={cn("mb-10 md:mb-12", center && "text-center")}>
      {intro.eyebrow ? (
        <p className={cn("text-xs font-extrabold uppercase tracking-[0.28em]", dark ? "text-brand-cyan" : "text-brand-pink")}>{intro.eyebrow}</p>
      ) : null}
      <h2 className={cn("mt-3 whitespace-pre-line text-balance font-display text-3xl leading-[1.05] md:text-5xl", dark ? "text-white" : "text-brand-ink")}>
        {intro.title}
      </h2>
      {intro.description ? (
        <p className={cn("mt-4 max-w-2xl whitespace-pre-line text-base leading-7", center && "mx-auto", dark ? "text-white/65" : "text-brand-ink/65")}>
          {intro.description}
        </p>
      ) : null}
    </div>
  );
}

function Section({ id, className, children }: { id?: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={cn("scroll-mt-24 px-4 py-14 md:px-6 md:py-20", className)}>
      <div className="mx-auto max-w-[1080px]">{children}</div>
    </section>
  );
}

export default async function WholesalePage() {
  const [content, settings] = await Promise.all([getWholesaleContent(), getStoreSettings()]);

  if (!content.enabled) {
    notFound();
  }

  if (!(await hasWholesaleAccess(content))) {
    return <WholesalePasswordGate />;
  }

  const whatsappNumber = content.whatsappNumber || settings?.whatsappNumber || FALLBACK_WHATSAPP;
  const { hero, products, profiles, reasons, conditions, steps, testimonials, faq } = content;
  // Las secciones alternan fondo blanco y rosado; las que no tienen elementos no se muestran.
  const showProfiles = profiles.items.length > 0;
  const showReasons = reasons.items.length > 0;

  return (
    <div className="overflow-hidden bg-white text-brand-ink">
      {content.topbar ? (
        <div className="bg-brand-ink px-4 py-2.5 text-center text-xs tracking-[0.06em] text-white/75">{content.topbar}</div>
      ) : null}

      <section className="relative bg-[#fff6f7] px-4 pb-14 pt-14 text-center md:px-6 md:pb-20 md:pt-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(244,137,145,0.18)_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-[820px]">
          {hero.eyebrow ? <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-pink">{hero.eyebrow}</p> : null}
          <h1 className="mt-5 whitespace-pre-line text-balance font-display text-[2.6rem] leading-[1.02] text-brand-ink md:text-[4.2rem]">
            {hero.title}
            {hero.titleAccent ? <span className="mt-3 block text-[0.55em] leading-[1.15] text-brand-pink">{hero.titleAccent}</span> : null}
          </h1>
          {hero.description ? (
            <p className="mx-auto mt-6 max-w-[620px] whitespace-pre-line text-base leading-7 text-brand-ink/70 md:text-lg md:leading-8">{hero.description}</p>
          ) : null}
          {hero.chips.length > 0 ? (
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              {hero.chips.map((chip, index) => (
                <span
                  key={`${chip.label}-${index}`}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-bold",
                    chip.accent ? "bg-brand-pink text-white" : "bg-white text-brand-ink ring-1 ring-brand-ink/10",
                  )}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#contacto" className={primaryCta}>
              {hero.primaryCta}
            </a>
            {content.contact.orderEnabled ? (
              <a href="#pedido" className={secondaryCta}>
                {hero.secondaryCta}
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {content.stats.length > 0 ? (
        <div className="bg-brand-pink px-4 py-7">
          <div className={cn("mx-auto grid max-w-[1080px] grid-cols-2 gap-6", content.stats.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3")}>
            {content.stats.map((stat, index) => (
              <div key={`${stat.value}-${index}`} className="text-center">
                <p className="font-display text-3xl leading-none text-white md:text-4xl">{stat.value}</p>
                <p className="mt-2 whitespace-pre-line text-xs leading-5 text-white/90">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {products.items.length > 0 ? (
        <Section id="productos">
          <SectionHeading intro={products} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {products.items.map((product, index) => (
              <div key={`${product.name}-${index}`} className="overflow-hidden rounded-[2rem] bg-white shadow-card">
                <div className="relative aspect-[4/3] bg-white">
                  <Image src={product.imageUrl} alt={product.imageAlt || product.name} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-contain" />
                </div>
                <div className="px-4 pb-5 pt-3">
                  <p className="font-display text-2xl leading-none text-brand-ink">{product.name}</p>
                  {product.description ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-brand-ink/65">{product.description}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {showProfiles ? (
        <Section className="bg-[#fff6f7]">
          <SectionHeading intro={profiles} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.items.map((profile, index) => (
              <div key={`${profile.title}-${index}`} className="rounded-[2rem] bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft">
                {profile.icon ? (
                  <p className="text-3xl" aria-hidden="true">
                    {profile.icon}
                  </p>
                ) : null}
                <p className="mt-3 text-base font-extrabold text-brand-ink">{profile.title}</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-brand-ink/65">{profile.description}</p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {showReasons ? (
        <Section>
          <SectionHeading intro={reasons} />
          <div className="grid gap-4 md:grid-cols-2">
            {reasons.items.map((reason, index) => (
              <div key={`${reason.title}-${index}`} className="flex items-start gap-4 rounded-[2rem] bg-[#fff6f7] p-6">
                {reason.icon ? (
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-pinkSoft text-xl">
                    {reason.icon}
                  </span>
                ) : null}
                <div>
                  <p className="text-base font-extrabold text-brand-ink">{reason.title}</p>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-brand-ink/65">{reason.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {conditions.plans.length > 0 ? (
        <Section id="condiciones" className="bg-[#fff6f7]">
          <SectionHeading intro={conditions} />
          <div className={cn("grid gap-5", conditions.plans.length === 2 && "md:grid-cols-2", conditions.plans.length >= 3 && "md:grid-cols-3")}>
            {conditions.plans.map((plan, index) => (
              <div key={`${plan.title}-${index}`} className={cn("overflow-hidden rounded-[2rem] bg-white shadow-card", plan.highlighted && "ring-2 ring-brand-cyan")}>
                <div className={cn("flex items-center gap-4 border-b px-6 pb-4 pt-6", plan.highlighted ? "border-brand-cyan/30 bg-brand-cyan/15" : "border-brand-ink/10")}>
                  {plan.icon ? (
                    <span className="text-3xl" aria-hidden="true">
                      {plan.icon}
                    </span>
                  ) : null}
                  <div>
                    <p className="font-display text-2xl leading-none text-brand-ink">{plan.title}</p>
                    {plan.subtitle ? <p className="mt-1 text-xs text-brand-ink/55">{plan.subtitle}</p> : null}
                  </div>
                </div>
                <div className="px-6 pb-6 pt-5">
                  <p className={cn("font-display text-4xl leading-none", plan.highlighted ? "text-brand-ink" : "text-brand-pink")}>
                    {formatArs(plan.price)}
                    {plan.priceUnit ? <span className="ml-1 font-body text-sm font-normal text-brand-ink/55">{plan.priceUnit}</span> : null}
                  </p>
                  {plan.rows.length > 0 ? (
                    <dl className="mt-5 divide-y divide-brand-ink/10">
                      {plan.rows.map((row, rowIndex) => (
                        <div key={`${row.label}-${rowIndex}`} className="flex justify-between gap-3 py-2.5 text-sm">
                          <dt className="shrink-0 font-bold text-brand-ink/70">{row.label}</dt>
                          <dd className="text-right leading-5 text-brand-ink">
                            {row.value}
                            {row.note ? <span className="block text-[11px] text-brand-ink/50">{row.note}</span> : null}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  <a
                    href="#contacto"
                    className={cn(
                      "mt-5 flex w-full items-center justify-center rounded-full px-6 py-3.5 text-sm font-extrabold transition",
                      plan.highlighted ? "bg-brand-cyan text-brand-ink hover:brightness-95" : "bg-brand-pink text-white shadow-soft hover:bg-[#ea737d]",
                    )}
                  >
                    {plan.cta}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {steps.items.length > 0 ? (
        <Section id="como-funciona">
          <SectionHeading intro={steps} center />
          <ol className={cn("relative grid gap-8 md:gap-0", steps.items.length >= 4 ? "md:grid-cols-4" : steps.items.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
            {steps.items.length > 1 ? (
              <span
                aria-hidden="true"
                className="absolute top-7 hidden h-0.5 bg-brand-pinkSoft md:block"
                style={{ left: `calc(${50 / Math.min(steps.items.length, 4)}% + 28px)`, right: `calc(${50 / Math.min(steps.items.length, 4)}% + 28px)` }}
              />
            ) : null}
            {steps.items.map((step, index) => (
              <li key={`${step.title}-${index}`} className="relative px-4 text-center md:px-6">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-pink font-display text-2xl text-white shadow-soft">
                  {index + 1}
                </span>
                <p className="mt-5 text-lg font-extrabold text-brand-ink">{step.title}</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-brand-ink/65">{step.description}</p>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {testimonials.items.length > 0 ? (
        <Section className="bg-brand-ink">
          <SectionHeading intro={testimonials} dark />
          <div className={cn("grid gap-4", testimonials.items.length > 1 && "md:grid-cols-2", testimonials.items.length > 2 && "lg:grid-cols-3")}>
            {testimonials.items.map((testimonial, index) => (
              <figure key={`${testimonial.name}-${index}`} className={cn("rounded-[2rem] border border-white/10 bg-white/5 p-6 md:p-8", testimonials.items.length === 1 && "max-w-2xl")}>
                {testimonial.tag ? <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-cyan">{testimonial.tag}</span> : null}
                <blockquote className="mt-3 whitespace-pre-line border-l-[3px] border-brand-pink pl-4 text-base italic leading-7 text-white/85">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-4">
                  <p className="text-sm font-extrabold text-white">{testimonial.name}</p>
                  {testimonial.meta ? <p className="text-xs text-white/55">{testimonial.meta}</p> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>
      ) : null}

      <Section id="contacto" className="bg-[#fff6f7]">
        <SectionHeading intro={content.contact} center />
        <WholesaleContact whatsappNumber={whatsappNumber} content={content.contact} />
      </Section>

      {faq.items.length > 0 ? (
        <Section id="faq">
          <SectionHeading intro={faq} center />
          <div className="mx-auto flex max-w-[760px] flex-col gap-3">
            {faq.items.map((item, index) => (
              <details key={`${item.question}-${index}`} className="group rounded-3xl bg-[#fff6f7] open:bg-white open:shadow-card">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-base font-extrabold text-brand-ink [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span aria-hidden="true" className="text-xl leading-none text-brand-pink group-open:hidden">
                    +
                  </span>
                  <span aria-hidden="true" className="hidden text-xl leading-none text-brand-pink group-open:inline">
                    −
                  </span>
                </summary>
                <p className="whitespace-pre-line px-5 pb-5 text-sm leading-6 text-brand-ink/70">{item.answer}</p>
              </details>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
