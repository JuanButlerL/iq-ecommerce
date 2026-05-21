"use client";

export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

type PixelEventOptions = Record<string, string | number | boolean | string[] | undefined>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}

export function isFacebookPixelEnabled() {
  return Boolean(FB_PIXEL_ID) && FB_PIXEL_ID !== "TU_PIXEL_ID";
}

export const pageview = () => {
  if (!isFacebookPixelEnabled() || typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  window.fbq("track", "PageView");
};

export const event = (name: string, options: PixelEventOptions = {}) => {
  if (!isFacebookPixelEnabled() || typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  window.fbq("track", name, options);
};
