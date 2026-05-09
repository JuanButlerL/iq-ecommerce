export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_category?: string;
  price?: number;
  quantity?: number;
};

type AnalyticsParams = Record<string, string | number | boolean | AnalyticsItem[] | undefined>;

type WebVitalMetric = {
  id: string;
  name: string;
  label: string;
  value: number;
};

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function isGoogleAnalyticsEnabled() {
  return Boolean(GA_MEASUREMENT_ID);
}

export function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  if (!isGoogleAnalyticsEnabled() || typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", eventName, params);
}

export function trackWebVital(metric: WebVitalMetric) {
  trackEvent("web_vital", {
    metric_id: metric.id,
    metric_name: metric.name,
    metric_label: metric.label,
    value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
  });
}
