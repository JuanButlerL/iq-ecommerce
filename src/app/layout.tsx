import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

import "@/app/globals.css";

import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { WebVitals } from "@/components/analytics/web-vitals";
import { AppChrome } from "@/components/layout/app-chrome";
import { getStoreSettings } from "@/features/settings/queries";
import { env } from "@/lib/env";
import { siteConfig } from "@/lib/utils/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "IQ Kids",
    template: "%s | IQ Kids",
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  openGraph: {
    title: "IQ Kids",
    description: siteConfig.description,
    siteName: "IQ Kids",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F48991",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const settings = await getStoreSettings();

  return (
    <html lang="es">
      <body>
        {env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? <GoogleAnalytics measurementId={env.NEXT_PUBLIC_GA_MEASUREMENT_ID} /> : null}
        <WebVitals />
        <AppChrome
          instagramUrl={settings?.instagramUrl}
          contactEmail={settings?.contactEmail}
          whatsappNumber={settings?.whatsappNumber}
          showFloatingWhatsapp={settings?.showFloatingWhatsapp}
        >
          {children}
        </AppChrome>
      </body>
    </html>
  );
}
