import type { ReactNode } from "react";
import type { Metadata } from "next";

import "@/app/globals.css";

import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { FloatingWhatsapp } from "@/components/layout/floating-whatsapp";
import { getStoreSettings } from "@/features/settings/queries";
import { siteConfig } from "@/lib/utils/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "IQ Kids",
    template: "%s | IQ Kids",
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  themeColor: "#F48991",
  openGraph: {
    title: "IQ Kids",
    description: siteConfig.description,
    siteName: "IQ Kids",
    type: "website",
  },
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
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter
          instagramUrl={settings?.instagramUrl}
          contactEmail={settings?.contactEmail}
          whatsappNumber={settings?.whatsappNumber}
        />
        {settings?.showFloatingWhatsapp ? (
          <FloatingWhatsapp
            phone={settings.whatsappNumber}
            message="Hola! Quiero consultar por las barritas de IQ Kids."
          />
        ) : null}
      </body>
    </html>
  );
}
