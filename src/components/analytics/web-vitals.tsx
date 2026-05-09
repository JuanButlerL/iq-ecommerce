"use client";

import { useReportWebVitals } from "next/web-vitals";

import { trackWebVital } from "@/lib/integrations/google-analytics/client";

export function WebVitals() {
  useReportWebVitals(trackWebVital);

  return null;
}
