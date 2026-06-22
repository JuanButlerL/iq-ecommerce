"use client";

export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

export type PixelEventOptions = Record<string, unknown>;
type PixelTrackingOptions = {
  eventID?: string;
};

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

export const event = (name: string, options: PixelEventOptions = {}, trackingOptions: PixelTrackingOptions = {}) => {
  if (!isFacebookPixelEnabled() || typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  window.fbq("track", name, options, trackingOptions);
};
