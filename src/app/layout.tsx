import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

import "@/app/globals.css";

import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { GoogleTagManager, GoogleTagManagerNoScript } from "@/components/analytics/google-tag-manager";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { MicrosoftClarity } from "@/components/analytics/microsoft-clarity";
import { WebVitals } from "@/components/analytics/web-vitals";
import { AppChrome } from "@/components/layout/app-chrome";
import { getStoreSettings } from "@/features/settings/queries";
import { env } from "@/lib/env";
import { absoluteUrl, JsonLd } from "@/lib/seo/json-ld";
import { getSiteLastUpdatedAt } from "@/lib/seo/last-updated";
import { siteConfig } from "@/lib/utils/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "IQ Kids",
    template: "%s | IQ Kids",
  },
icons: {
  icon: [{ url: "/icon.svg?v=20260825-2", type: "image/svg+xml" }],
  shortcut: ["/icon.svg?v=20260825-2"],
},
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  openGraph: {
    title: "IQ Kids",
    description: siteConfig.description,
    siteName: "IQ Kids",
    type: "website",
    images: [{ url: "/brand/iq-kids-logo.png", alt: "IQ Kids" }],
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
  const [settings, lastUpdatedAt] = await Promise.all([getStoreSettings(), getSiteLastUpdatedAt()]);
  const clarityProjectId = env.NEXT_PUBLIC_MICROSOFT_CLARITY_ID || "wqhtpsarz4";
  const facebookPixelId = env.hasFacebookPixel ? env.NEXT_PUBLIC_FB_PIXEL_ID : null;
  const googleTagManagerId = env.hasGoogleTagManager ? env.NEXT_PUBLIC_GTM_ID : null;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": absoluteUrl("/#organization"),
        name: siteConfig.name,
        url: absoluteUrl("/"),
        logo: absoluteUrl("/brand/iq-kids-logo.png"),
        parentOrganization: { "@type": "Organization", name: siteConfig.companyName },
        ...(settings?.instagramUrl ? { sameAs: [settings.instagramUrl] } : {}),
      },
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        name: siteConfig.name,
        url: absoluteUrl("/"),
        inLanguage: "es-AR",
        publisher: { "@id": absoluteUrl("/#organization") },
        ...(lastUpdatedAt ? { dateModified: lastUpdatedAt.toISOString() } : {}),
      },
    ],
  };

  return (
    <html lang="es">
      <head>
        <meta name="facebook-domain-verification" content="uxoukek4qpm1l9lb4w8fjzgr1rm43c" />
        {googleTagManagerId ? <GoogleTagManager containerId={googleTagManagerId} /> : null}
      </head>
      <body>
        <JsonLd data={structuredData} />
        {googleTagManagerId ? <GoogleTagManagerNoScript containerId={googleTagManagerId} /> : null}
        {env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? <GoogleAnalytics measurementId={env.NEXT_PUBLIC_GA_MEASUREMENT_ID} /> : null}
        <MicrosoftClarity projectId={clarityProjectId} />
        {facebookPixelId ? <MetaPixel pixelId={facebookPixelId} /> : null}
        <WebVitals />
        <AppChrome
          instagramUrl={settings?.instagramUrl}
          contactEmail={settings?.contactEmail}
          whatsappNumber={settings?.whatsappNumber}
          showFloatingWhatsapp={settings?.showFloatingWhatsapp}
          announcementBarEnabled={settings?.announcementBarEnabled}
          announcementBarText={settings?.announcementBarText}
          subscriptionSectionEnabled={settings?.subscriptionSectionEnabled}
          faqSectionEnabled={settings?.faqSectionEnabled}
          newsletterSectionEnabled={settings?.newsletterSectionEnabled}
          lastUpdatedAt={lastUpdatedAt?.toISOString()}
        >
          {children}
        </AppChrome>
      </body>
    </html>
  );
}
