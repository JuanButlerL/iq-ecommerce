import type { HomeHeroSlide } from "@/features/home-slides/components/home-hero-carousel";

// The original hero photo needs its own framing to keep the people visible next to the text.
export const ORIGINAL_HERO_IMAGE = "/redesign/hero-home.jpg";
export const ORIGINAL_HERO_IMAGE_CLASS =
  "absolute inset-0 h-full w-full object-cover object-[72%_center] sm:object-[76%_center] lg:left-0 lg:w-[118%] lg:max-w-none lg:object-left xl:w-[116%]";

export function withHeroImageFraming<T extends Omit<HomeHeroSlide, "imageClassName">>(slide: T): T & HomeHeroSlide {
  return slide.imageUrl === ORIGINAL_HERO_IMAGE ? { ...slide, imageClassName: ORIGINAL_HERO_IMAGE_CLASS } : slide;
}

// The admin preview renders the real carousel inside an iframe and feeds it slides through postMessage.
export const HOME_CAROUSEL_PREVIEW_PATH = "/admin-preview/home-carrusel";

export type HomeCarouselPreviewMessage =
  | { type: "home-carousel-preview:ready" }
  | { type: "home-carousel-preview:height"; height: number }
  | { type: "home-carousel-preview:slides"; slides: HomeHeroSlide[]; initialIndex: number };
