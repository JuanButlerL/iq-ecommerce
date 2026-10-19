import Link from "next/link";

import { HashScrollHandler } from "@/components/hash-scroll-handler";
import { applyProductDiscount } from "@/features/catalog/lib/product-discount";
import { HomeProductCardActions } from "@/features/catalog/components/home-product-card-actions";
import { ProductPrice } from "@/features/catalog/components/product-price";
import { HomeProductsScroller } from "@/features/catalog/components/home-products-scroller";
import { HOME_PRODUCTS_GRID_LIMIT } from "@/features/catalog/lib/home-products";
import { getVisibleProducts } from "@/features/catalog/queries";
import { getHomeFeaturedProductSlots } from "@/features/home-featured-products/queries";
import { HomeHeroCarousel, type HomeHeroSlide } from "@/features/home-slides/components/home-hero-carousel";
import { getActiveHomeSlides } from "@/features/home-slides/queries";
import { getStoreSettingsForClient } from "@/features/settings/queries";
import { TestimonialsCarousel } from "@/features/testimonials/components/testimonials-carousel";
import { getActiveTestimonials } from "@/features/testimonials/queries";

type ProductItem = Awaited<ReturnType<typeof getVisibleProducts>>[number];
type HomeProductCardItem = {
  slotOrder: number;
  product: ProductItem;
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
};

// The original hero photo needs its own framing to keep the people visible next to the text.
const ORIGINAL_HERO_IMAGE = "/redesign/hero-home.jpg";
const ORIGINAL_HERO_IMAGE_CLASS =
  "absolute inset-0 h-full w-full object-cover object-[72%_center] sm:object-[76%_center] lg:left-0 lg:w-[118%] lg:max-w-none lg:object-left xl:w-[116%]";

// Keep the section ready while its final content and imagery are being defined.
const SHOW_PROCESS_SECTION = false;

const processSteps = [
  {
    title: "Nutricionistas eligieron por vos",
    body: "Revisaron ingredientes, descartaron lo que no vale y eligieron lo que sí.",
  },
  {
    title: "Vos no leés etiquetas ni comparás",
    body: "El trabajo difícil ya está hecho. Resolver el snack toma segundos.",
  },
  {
    title: "El snack de tu hijo ya está resuelto",
    body: "Para las mañanas apuradas, las mochilas y los tuppers.",
  },
];

const whyKidsLikeIt = [
  {
    title: "¡Les encanta!",
    body: "Sabores que aceptan naturalmente, sin negociar ni esconder nada en el medio.",
    accent: "bg-brand-cyan",
  },
  {
    title: "Energía real",
    body: "Sin pico de azúcar. Energía sostenida para el recreo y el club.",
    accent: "bg-brand-yellow",
  },
  {
    title: "Ingredientes que reconocés",
    body: "Sin sellos negros, sin nombres raros. Lo que ves es lo que hay.",
    accent: "bg-brand-pink",
  },
  {
    title: "Bienestar diario",
    body: "Duerme bien, tiene energía estable. Sin el bajón de después.",
    accent: "bg-brand-cyan",
  },
];

const ingredientPoints = [
  {
    title: "Ingredientes reales",
    body: "4 a 6 ingredientes. Lo que ves es lo que hay.",
    icon: "/redesign/ingredient-real.svg",
    iconAlt: "Ingredientes reales",
    iconClass: "h-9 w-9 sm:h-10 sm:w-10",
    iconSurface: "border-[#B9DCC2] bg-[#EAF7EE]",
  },
  {
    title: "Sin azúcar agregada",
    body: "Sin endulzantes escondidos en el listado.",
    icon: "/redesign/ingredient-no-sugar-20260615.png",
    iconAlt: "Sin azucar agregada",
    iconClass: "h-9 w-9 sm:h-10 sm:w-10",
    iconSurface: "border-[#F2B8BD] bg-[#FFF0F1]",
  },
  {
    title: "Sin TACC",
    body: "Apta para celiacos. Sin contaminacion cruzada.",
    icon: "/redesign/ingredient-gluten-free.svg",
    iconAlt: "Sin TACC",
    iconClass: "h-10 w-10 sm:h-11 sm:w-11",
    iconSurface: "border-[#B9DDEB] bg-[#EAF8FE]",
  },
  {
    title: "Sin sellos",
    body: "Sin conservantes, colorantes ni artificiales.",
    icon: "/redesign/ingredient-no-warnings.svg",
    iconAlt: "Sin sellos",
    iconClass: "h-10 w-10 sm:h-11 sm:w-11",
    iconSurface: "border-[#D5D7DC] bg-[#F1F2F4]",
  },
];

const whyKidsLikeItImages = [
  "/redesign/natural-simple-1.jpg",
  "/redesign/natural-simple-2.jpg",
  "/redesign/natural-simple-3.jpg",
  "/redesign/natural-simple-4.jpg",
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getUnitPriceLabel(product: ProductItem) {
  const units = product.name.toLowerCase().includes("x 12") ? 12 : null;

  if (!units) {
    return null;
  }

  return `${formatCurrency(Math.round(product.priceArs / units))} por unidad`;
}

function getThemeColors(product: ProductItem) {
  const fallbackByTheme = {
    CACAO: {
      accent: "#F48991",
      surface: "#FFF3F4",
      text: "#2c2241",
      image: "/redesign/product-cacao.png",
    },
    BANANA: {
      accent: "#ffd35c",
      surface: "#FFF8DF",
      text: "#2c2241",
      image: "/redesign/product-banana.png",
    },
    PEANUT: {
      accent: "#7bd8f7",
      surface: "#EEF9FE",
      text: "#2c2241",
      image: "/redesign/product-peanut.png",
    },
  } as const;

  const fallback = fallbackByTheme[product.colorTheme];
  const primaryImage =
    product.images.find((image) => image.isPrimary)?.publicUrl ??
    product.images[0]?.publicUrl ??
    fallback.image;

  return {
    accent: product.visualAccentHex ?? fallback.accent,
    surface: product.visualSurfaceHex ?? fallback.surface,
    text: product.visualTextHex ?? fallback.text,
    image: primaryImage,
  };
}

function findProductsForLanding(products: ProductItem[]) {
  const findByTerms = (terms: string[]) =>
    products.find((product) => {
      const haystack = `${product.name} ${product.slug} ${product.shortDescription} ${product.longDescription}`.toLowerCase();
      return terms.some((term) => haystack.includes(term));
    });

  const peanut = findByTerms(["mani", "maní", "peanut"]);
  const cacao = findByTerms(["cacao", "choco", "chocolate"]);
  const banana = findByTerms(["banana", "platano", "plátano"]);

  const used = new Set<string>([peanut?.id, cacao?.id, banana?.id].filter(Boolean) as string[]);
  const remaining = products.filter((product) => !used.has(product.id));

  return {
    peanut: peanut ?? remaining[0] ?? products[0],
    cacao: cacao ?? remaining[1] ?? products[1] ?? products[0],
    banana: banana ?? remaining[2] ?? products[2] ?? products[0],
  };
}

function ProductLandingCard({
  product,
  eyebrow,
  title,
}: {
  product: ProductItem;
  eyebrow: string;
  title: string;
}) {
  const theme = getThemeColors(product);

  return (
    <Link
      href={`/productos/${product.slug}`}
      className="group flex min-w-[280px] max-w-[320px] snap-start flex-col overflow-hidden rounded-[2rem] border border-brand-ink/10 bg-white shadow-card transition-transform duration-200 hover:-translate-y-1"
      style={{ backgroundColor: theme.surface, color: theme.text }}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={theme.image}
          alt={product.name}
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em]" style={{ color: theme.accent }}>
            {eyebrow}
          </p>
          <h3 className="font-display text-2xl leading-tight">{title}</h3>
          <p className="text-sm leading-6 text-brand-ink/80">{product.shortDescription}</p>
        </div>
        <div className="mt-auto space-y-4">
          <div className="flex items-center justify-between">
            <ProductPrice
              className="text-lg font-extrabold"
              priceArs={product.priceArs}
              listPriceArs={product.listPriceArs}
              discountPercentage={product.activeDiscountPercentage}
            />
            <span
              className="rounded-full px-4 py-2 text-sm font-extrabold text-white transition group-hover:translate-x-1"
              style={{ backgroundColor: theme.accent }}
            >
              Ver producto →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function findHomeProductByTerms(products: ProductItem[], terms: string[]) {
  return products.find((product) => {
    const haystack = `${product.name} ${product.slug} ${product.shortDescription} ${product.longDescription}`.toLowerCase();
    return terms.some((term) => haystack.includes(term));
  });
}

function buildHomeFeaturedFallbackSlots(products: ProductItem[]) {
  const mix = findHomeProductByTerms(products, ["mix", "3 sabores", "tres sabores"]) ?? products[0];
  const peanut = findHomeProductByTerms(products, ["mani", "maní", "peanut"]) ?? products[1] ?? products[0];
  const cacao = findHomeProductByTerms(products, ["cacao", "choco", "chocolate"]) ?? products[2] ?? products[0];
  const banana = findHomeProductByTerms(products, ["banana", "platano", "plátano"]) ?? products[3] ?? products[0];

  return [
    {
      slotOrder: 1,
      product: mix,
      eyebrow: "Banana · Maní · Cacao",
      title: "Descubrí el favorito de tu hijo",
      description: "Empezá por una selección pensada para probar sabores y resolver la semana.",
      quote: "Una genialidad, me di cuenta que su preferido es el de cacao.",
      buttonLabel: "Ver producto →",
    },
    {
      slotOrder: 2,
      product: peanut,
      eyebrow: peanut?.name ?? "",
      title: "La vianda resuelta para toda la semana",
      description: peanut?.shortDescription ?? "",
      quote: "La vianda volvió vacía. Eso no pasaba en meses.",
      buttonLabel: "Ver producto →",
    },
    {
      slotOrder: 3,
      product: cacao,
      eyebrow: cacao?.name ?? "",
      title: "Chocolate sin leer etiquetas",
      description: cacao?.shortDescription ?? "",
      quote: "Siempre batallé con los snacks. Esta la pide él solo.",
      buttonLabel: "Ver producto →",
    },
    {
      slotOrder: 4,
      product: banana,
      eyebrow: banana?.name ?? "",
      title: "Ingredientes que reconocés, sabor que acepta",
      description: banana?.shortDescription ?? "",
      quote: "La lleva al colegio, a la plaza, al club. Va a todos lados.",
      buttonLabel: "Ver producto →",
    },
  ].filter((slot) => Boolean(slot.product));
}

function HomeFeaturedSlotCard({
  product,
  eyebrow,
  title,
  description,
  buttonLabel,
  highlighted = false,
  inScroller = false,
}: {
  product: ProductItem;
  eyebrow: string;
  title: string;
  description: string;
  buttonLabel: string;
  highlighted?: boolean;
  inScroller?: boolean;
}) {
  const theme = getThemeColors(product);
  const homeLabel = product.homeVarietyLabel?.trim() || eyebrow;
  const unitPriceLabel = getUnitPriceLabel(product);

  return (
    <article
      className={`group flex h-auto w-[82%] min-w-0 shrink-0 snap-start self-stretch flex-col overflow-hidden rounded-[2rem] border bg-white transition-all duration-200 hover:-translate-y-1 ${
        // In the scroller cards stretch to the tallest one; a fixed 100% height would block that.
        inScroller
          ? "md:w-[calc((100%_-_1.25rem)/2)] xl:w-[calc((100%_-_3.75rem)/4)]"
          : "md:h-full md:w-auto md:shrink"
      } ${
        highlighted
          ? "border-brand-pink/60 shadow-[0_20px_48px_rgba(244,137,145,0.2)] ring-1 ring-brand-pink/20"
          : "border-brand-ink/10 shadow-card"
      }`}
      style={{ backgroundColor: theme.surface, color: theme.text }}
    >
      <Link href={`/productos/${product.slug}`} className="relative aspect-[4/3] overflow-hidden">
        {highlighted ? (
          <span className="absolute left-4 top-4 z-10 rounded-full bg-brand-pink px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-white shadow-soft">
            Más elegido
          </span>
        ) : null}
        <img
          src={theme.image}
          alt={product.name}
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em]" style={{ color: theme.accent }}>
            {homeLabel}
          </p>
          <Link href={`/productos/${product.slug}`} className="block">
            <h3 className="font-display text-2xl leading-tight">{title}</h3>
          </Link>
          <p className="text-sm leading-6 text-brand-ink/80">{description}</p>
        </div>
        <div className="mt-auto space-y-4">
          <div className="space-y-3">
            <div>
              <ProductPrice
                className="text-lg font-extrabold"
                priceArs={product.priceArs}
                listPriceArs={product.listPriceArs}
                discountPercentage={product.activeDiscountPercentage}
              />
              {unitPriceLabel ? (
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-ink/45">
                  {unitPriceLabel}
                </p>
              ) : null}
            </div>
            <HomeProductCardActions
              productId={product.id}
              productName={product.name}
              priceArs={product.priceArs}
              accent={theme.accent}
              buttonLabel={buttonLabel}
              productHref={`/productos/${product.slug}`}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

export default async function HomePage() {
  const [settings, products, homeFeaturedSlots, testimonials, homeSlides] = await Promise.all([
    getStoreSettingsForClient(),
    getVisibleProducts(),
    getHomeFeaturedProductSlots(),
    getActiveTestimonials(),
    getActiveHomeSlides(),
  ]);

  const hasTestimonials = testimonials.length > 0;
  const hasProducts = products.length > 0;
  const showSubscriptionSection = Boolean(settings?.subscriptionSectionEnabled);
  const subscriptionHeroNote = settings?.subscriptionHeroNote?.trim();
  const firstProduct = products[0];
  const heroDefaultProduct = homeFeaturedSlots.find((slot) => slot.slotOrder === 1)?.product ?? firstProduct;
  const heroCtaLabel = settings?.heroCtaLabel?.trim() || "Empezá con la caja mix → 3 sabores, 12 barritas";
  const heroCtaUrl = settings?.heroCtaUrl?.trim() || (heroDefaultProduct ? `/productos/${heroDefaultProduct.slug}` : "/productos");
  // Slides come from the admin (the original hero is one of them, editable like the rest).
  // With no active slides the home falls back to the original hero.
  const heroSlides: HomeHeroSlide[] =
    homeSlides.length > 0
      ? homeSlides.map((slide) =>
          slide.imageUrl === ORIGINAL_HERO_IMAGE ? { ...slide, imageClassName: ORIGINAL_HERO_IMAGE_CLASS } : slide,
        )
      : [
          {
            id: "default-hero",
            eyebrow: "Snacks para niños",
            title: "Entre mochilas, corridas y tuppers… por lo menos que el snack ya esté resuelto.",
            mobileTitle: "El snack ya está resuelto.",
            subtitle: "Nutricionistas eligieron cada producto para que vos no tengas que leer etiquetas ni dudar.",
            badges: ["Nutricionistas", "Sin sellos", "Ingredientes reales"],
            ctaLabel: heroCtaLabel,
            ctaUrl: heroCtaUrl,
            imageUrl: ORIGINAL_HERO_IMAGE,
            mobileImageUrl: null,
            imageAlt: settings?.storeName ?? "IQ Kids",
            imageClassName: ORIGINAL_HERO_IMAGE_CLASS,
          },
        ];
  const landingProducts = findProductsForLanding(products);
  const subscriptionItems = [
    settings?.subscriptionItemOne?.trim(),
    settings?.subscriptionItemTwo?.trim(),
    settings?.subscriptionItemThree?.trim(),
  ].filter((item): item is string => Boolean(item));
  // Hidden or inactive products are skipped so the home never links to an unavailable page.
  const visibleFeaturedSlots = homeFeaturedSlots.filter(
    (slot: typeof homeFeaturedSlots[number]) => slot.product.active && slot.product.visible,
  );
  const homeProductCards: HomeProductCardItem[] =
    visibleFeaturedSlots.length > 0
      ? visibleFeaturedSlots.map((slot: typeof homeFeaturedSlots[number]) => ({
          slotOrder: slot.slotOrder,
          product: applyProductDiscount(slot.product),
          eyebrow: slot.eyebrow,
          title: slot.title,
          description: slot.description,
          buttonLabel: slot.buttonLabel,
        }))
      : buildHomeFeaturedFallbackSlots(products);
  const homeProductsScroll = homeProductCards.length > HOME_PRODUCTS_GRID_LIMIT;

  return (
    <main className="flex flex-col overflow-x-hidden bg-white text-brand-ink">
      <HashScrollHandler />
      <HomeHeroCarousel
        slides={heroSlides}
        footnote={showSubscriptionSection ? subscriptionHeroNote : null}
        intervalSeconds={settings?.heroCarouselIntervalSeconds ?? 7}
      />

      {SHOW_PROCESS_SECTION ? (
        <section id="como-funciona" className="bg-white py-12 sm:py-14 lg:py-16">
          <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 xl:px-12">
            <div className="max-w-3xl">
              <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-pink">¿Cómo funciona?</p>
              <h2 className="mt-4 font-display text-[2.4rem] leading-[1.02] text-brand-ink sm:text-[3.35rem]">
                Una decisión menos todos los días.
              </h2>
            </div>
            <div className="mt-10 grid items-start gap-5 lg:grid-cols-3">
              {processSteps.map((step, index) => (
                <article
                  key={step.title}
                  className="group relative h-fit overflow-hidden rounded-[2rem] border border-brand-ink/10 bg-[#fff8f8] p-4 shadow-card transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-brand-pink/28 hover:shadow-[0_24px_56px_rgba(244,137,145,0.18)] lg:px-6 lg:py-5"
                >
                  <div className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-brand-pink transition-transform duration-300 ease-out group-hover:scale-x-100" />
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(244,137,145,0.14),transparent_34%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="flex items-start gap-3 lg:gap-4">
                    <div className="relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-pink text-base font-extrabold text-white shadow-[0_10px_18px_rgba(244,137,145,0.22)] transition-all duration-300 group-hover:scale-105 group-hover:bg-[#ef7f89] group-hover:shadow-[0_14px_28px_rgba(244,137,145,0.3)] lg:h-12 lg:w-12 lg:text-lg">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-[1rem] leading-[1.08] text-brand-ink transition-colors duration-300 group-hover:text-[#221838] lg:text-2xl lg:leading-tight">
                        {step.title}
                      </h3>
                      <p className="mt-1.5 text-[0.9rem] leading-6 text-brand-ink/78 transition-colors duration-300 group-hover:text-brand-ink/92 lg:mt-3 lg:text-base">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="order-1 bg-[#fffaf0] py-12 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 xl:px-12">
          <div className="max-w-3xl">
            <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-pink">
              ¿Por qué les encanta a los chicos?
            </p>
            <h2 className="mt-4 font-display text-[2.4rem] leading-[1.02] text-brand-ink sm:text-[3.35rem]">
              Naturales, simples y pensadas para ellos.
            </h2>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {whyKidsLikeIt.map((item, index) => (
              <article
                key={item.title}
                className="group overflow-hidden rounded-[2rem] bg-white shadow-card transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_24px_56px_rgba(44,34,65,0.16)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <img
                    src={whyKidsLikeItImages[index]}
                    alt={item.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(44,34,65,0.18))] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="absolute inset-x-6 bottom-5 h-px scale-x-0 bg-white/75 transition-transform duration-300 ease-out group-hover:scale-x-100" />
                </div>
                <div className="relative p-4 transition-colors duration-300 group-hover:bg-[#fffaf9] sm:p-7">
                  <div className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-brand-pink transition-transform duration-300 ease-out group-hover:scale-x-100" />
                  <h3 className="font-display text-xl text-brand-ink transition-colors duration-300 group-hover:text-[#24193b] sm:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-brand-ink/78 transition-colors duration-300 group-hover:text-brand-ink/92 sm:mt-3 sm:text-base sm:leading-7">
                    {item.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="ingredientes" className="order-4 bg-[#fffaf6] py-12 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 xl:px-12">
          <div className="max-w-4xl">
            <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-pink">
              Lo que tiene y lo que no tiene
            </p>
            <h2 className="mt-4 font-display text-[2.4rem] leading-[1.02] text-brand-ink sm:text-[3.35rem]">
              Ingredientes que reconocés. Nada más.
            </h2>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {ingredientPoints.map((item) => {
              return (
                <article
                  key={item.title}
                  className="group relative overflow-hidden rounded-[1.6rem] border border-brand-ink/10 bg-white px-3.5 py-4 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-brand-pink/30 hover:shadow-[0_18px_38px_rgba(244,137,145,0.14)] sm:px-5 sm:py-5 xl:min-h-[112px] xl:rounded-[1.45rem]"
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand-pink/0 blur-2xl transition-colors duration-300 group-hover:bg-brand-pink/10" />
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center xl:flex-row xl:justify-start xl:gap-4 xl:text-left">
                    <div
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.1rem] border shadow-[0_12px_24px_rgba(44,34,65,0.08)] transition-transform duration-300 group-hover:scale-105 sm:h-16 sm:w-16 xl:h-[4.15rem] xl:w-[4.15rem] ${item.iconSurface}`}
                    >
                      <img
                        src={item.icon}
                        alt={item.iconAlt}
                        width={42}
                        height={42}
                        className={`${item.iconClass} object-contain`}
                      />
                    </div>
                    <h3 className="max-w-[9.5rem] font-display text-[1.15rem] leading-[1.04] text-brand-ink sm:max-w-[11rem] sm:text-[1.35rem] xl:max-w-[10.5rem] xl:text-[1.42rem]">
                      {item.title}
                    </h3>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="productos" className="order-2 bg-[#fff6f7] py-12 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 xl:px-12">
          <div className="max-w-3xl">
            <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-pink">Empezá por acá</p>
            <h2 className="mt-4 font-display text-[2.4rem] leading-[1.02] text-brand-ink sm:text-[3.35rem]">
              Descubrí el favorito de tu hijo.
            </h2>
            <p className="mt-5 inline-flex items-center gap-3 rounded-full bg-white/80 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-ink/65 shadow-sm md:hidden">
              Deslizá para ver más
              <span className="animate-pulse text-lg leading-none text-brand-pink" aria-hidden="true">→</span>
            </p>
          </div>

          <HomeProductsScroller itemCount={hasProducts ? homeProductCards.length : 0}>
            {hasProducts
              ? homeProductCards.map((slot: HomeProductCardItem, index: number) => (
                  <HomeFeaturedSlotCard
                    key={`${slot.slotOrder}-${slot.product.id}`}
                    product={slot.product}
                    eyebrow={slot.eyebrow}
                    title={slot.title}
                    description={slot.description}
                    buttonLabel={slot.buttonLabel}
                    highlighted={index === 0}
                    inScroller={homeProductsScroll}
                  />
                ))
              : null}
          </HomeProductsScroller>

          <div className="hidden mt-10 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4">
            <article className="flex min-w-[280px] max-w-[320px] snap-start flex-col overflow-hidden rounded-[2rem] border border-brand-ink/10 bg-white shadow-card">
              <div className="relative aspect-[4/3] overflow-hidden bg-[linear-gradient(135deg,rgba(244,137,145,0.17),rgba(123,216,247,0.18),rgba(255,211,92,0.20))]">
                <img
                  src="/redesign/decision-less-2.jpg"
                  alt="Caja mix IQ Kids"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col gap-4 p-6">
                <div className="space-y-2">
                  <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-brand-pink">
                    Banana · Maní · Cacao
                  </p>
                  <h3 className="font-display text-2xl leading-tight text-brand-ink">
                    Descubrí el favorito de tu hijo
                  </h3>
                  <p className="text-sm leading-6 text-brand-ink/80">
                    Empezá por una selección pensada para probar sabores y resolver la semana.
                  </p>
                </div>
                <div className="mt-auto space-y-4">
                  <p className="text-sm font-semibold italic text-brand-ink/80">
                    “Una genialidad, me di cuenta que su preferido es el de cacao.”
                  </p>
                  <Link
                    href="/productos"
                    className="inline-flex w-fit rounded-full bg-brand-pink px-5 py-3 text-sm font-extrabold text-white transition hover:bg-[#ea737d]"
                  >
                    Ver todos →
                  </Link>
                </div>
              </div>
            </article>

            {hasProducts ? (
              <>
                <ProductLandingCard
                  product={landingProducts.peanut}
                  eyebrow={landingProducts.peanut.name}
                  title="La vianda resuelta para toda la semana"
                />
                <ProductLandingCard
                  product={landingProducts.cacao}
                  eyebrow={landingProducts.cacao.name}
                  title="Chocolate sin leer etiquetas"
                />
                <ProductLandingCard
                  product={landingProducts.banana}
                  eyebrow={landingProducts.banana.name}
                  title="Ingredientes que reconocés, sabor que acepta"
                />
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section
        id="quienes-somos"
        className="order-5 overflow-hidden bg-white py-0"
      >
        <div className="grid w-full items-stretch gap-0 overflow-hidden bg-white lg:grid-cols-[1.02fr_0.98fr] lg:rounded-l-[2.8rem] lg:rounded-r-none">
          <div className="relative order-2 lg:order-1">
            <div className="relative px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12 xl:pl-[max(5rem,calc((100vw-1600px)/2+5rem))] xl:pr-12">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex rounded-full bg-brand-pink/12 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.28em] text-brand-pink">
                  Nuestra historia
                </span>
              </div>
              <h2 className="mt-6 max-w-4xl font-display text-[2.45rem] leading-[1] text-brand-ink sm:text-[3.35rem] xl:text-[4rem]">
                Somos padres que sabemos lo que es querer hacer las cosas bien y no tener tiempo para hacerlo.
              </h2>
              <div className="mt-7 space-y-5 text-lg leading-8 text-brand-ink/78 lg:max-w-[92%]">
              <p>
                IQ Kids nació de esa tensión diaria entre querer ofrecer algo mejor y no tener una hora libre para
                comparar ingredientes, etiquetas ni promesas.
              </p>
              <p>
                Trabajamos con nutricionistas para elegir snacks simples, reales y prácticos. Lo hicimos para nuestras
                familias y ahora lo ponemos al alcance de otras.
              </p>
            </div>
            <div className="mt-9 grid gap-3">
              <div className="rounded-[1.8rem] bg-[linear-gradient(135deg,#fff9fa,#fff3f4)] px-6 py-5 text-base font-bold leading-7 text-brand-ink shadow-sm">
                La practicidad no contradice la buena nutrición. La hace posible.
              </div>
              <div className="rounded-[1.8rem] bg-[linear-gradient(135deg,#f6fcff,#edf8fe)] px-6 py-5 text-base font-bold leading-7 text-brand-ink shadow-sm">
                Los padres ya hacen muchísimo. No necesitan otra fuente de presión.
              </div>
              <div className="rounded-[1.8rem] bg-[linear-gradient(135deg,#fffdf2,#fff7d9)] px-6 py-5 text-base font-bold leading-7 text-brand-ink shadow-sm">
                La tranquilidad también es un valor nutricional.
              </div>
            </div>
            </div>
          </div>
          <div className="relative order-1 lg:order-2">
            <div className="relative h-full min-h-[300px] overflow-hidden bg-transparent p-0 sm:min-h-[360px] lg:min-h-0">
              <div className="relative h-full overflow-hidden">
                <img
                  src="/redesign/who-we-are.jpg"
                  alt="Familia IQ Kids"
                  className="absolute inset-0 h-full w-full object-cover object-center lg:object-[70%_center] xl:object-[72%_center] 2xl:object-[68%_center]"
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(44,34,65,0.1))]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {hasTestimonials ? (
        <section id="testimonios" className="order-3 bg-[#fffaf0] py-12 sm:py-14 lg:py-16">
          <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 xl:px-12">
            <div className="max-w-5xl">
              <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-brand-pink">Lo que dicen las mamás</p>
              <h2 className="mt-4 font-display text-[2.45rem] leading-[1] text-brand-ink sm:text-[3.35rem] lg:text-[4rem]">
                Palabras reales de familias reales.
              </h2>
              <p className="mt-5 text-sm font-bold uppercase tracking-[0.22em] text-brand-ink/58">
                Comentarios reales de clientes
              </p>
            </div>

            <TestimonialsCarousel testimonials={testimonials} />
          </div>
        </section>
      ) : null}

      {showSubscriptionSection ? (
        <section id="suscripcion" className="order-6 overflow-hidden bg-white py-0">
          <div className="grid w-full items-stretch gap-0 overflow-hidden rounded-none bg-[#fffaf6] lg:grid-cols-[0.96fr_1.04fr]">
            <div className="relative min-h-[300px] overflow-hidden sm:min-h-[360px] lg:min-h-[760px]">
              <img
                src="/redesign/decision-less-3.jpg"
                alt="Suscripción IQ Kids"
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(44,34,65,0.12),rgba(44,34,65,0.02)_34%,rgba(255,255,255,0)_72%)]" />
            </div>

            <div className="relative">
              <div className="px-6 py-8 sm:px-8 sm:py-12 lg:px-10 lg:py-14 xl:pr-[max(5rem,calc((100vw-1600px)/2+5rem))] xl:pl-12">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex rounded-full bg-brand-ink/[0.04] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em] text-brand-ink/55">
                    Suscripción mensual
                  </span>
                </div>

                <h2 className="mt-6 max-w-4xl font-display text-[2.45rem] leading-[1] text-brand-ink sm:text-[3.35rem] xl:text-[3.9rem]">
                  Algo más integral está por llegar.
                </h2>

                <div className="mt-7 max-w-3xl space-y-5 text-lg leading-8 text-brand-ink/78">
                  <p>
                    Estamos armando un plan mensual para que la resolución no sea compra por compra, sino una tranquilidad
                    instalada en la rutina.
                  </p>
                  <p>
                    La idea es que todo quede más simple: menos decisiones repetidas, más previsibilidad y una vianda
                    resuelta con anticipación.
                  </p>
                </div>

                <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                  <Link
                    href={settings?.subscriptionCtaUrl?.trim() || (settings?.whatsappNumber ? `https://wa.me/${settings.whatsappNumber}` : "/productos")}
                    className="inline-flex rounded-full bg-brand-pink px-7 py-4 text-base font-extrabold text-white shadow-soft transition hover:bg-[#ea737d]"
                  >
                    Anotarme en la lista →
                  </Link>
                </div>

                <div className="mt-8 grid gap-3 md:grid-cols-3">
                  {subscriptionItems.map((item, index) => {
                    const variants = [
                      "bg-white",
                      "bg-[linear-gradient(180deg,rgba(123,216,247,0.14),rgba(255,255,255,0.92))]",
                      "bg-[linear-gradient(180deg,rgba(255,211,92,0.18),rgba(255,255,255,0.95))]",
                    ];
                    const accents = ["#F48991", "#7bd8f7", "#ffd35c"];

                    return (
                      <article
                        key={item}
                        className={`group rounded-[1.8rem] border border-brand-ink/8 px-5 py-5 shadow-sm transition hover:-translate-y-0.5 ${variants[index % variants.length]}`}
                      >
                        <span
                          className="block h-1 w-12 rounded-full"
                          style={{ backgroundColor: accents[index % accents.length] }}
                        />
                        <p className="mt-4 text-base font-bold leading-7 text-brand-ink">{item}</p>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}


