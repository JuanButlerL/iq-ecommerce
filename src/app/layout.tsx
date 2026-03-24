import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

import "@/app/globals.css";

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
