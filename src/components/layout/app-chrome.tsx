"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { FloatingWhatsapp } from "@/components/layout/floating-whatsapp";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { TabTitleNudge } from "@/components/layout/tab-title-nudge";
import { WelcomePopup } from "@/features/marketing/components/welcome-popup";

type AppChromeProps = {
  children: ReactNode;
  instagramUrl?: string | null;
  contactEmail?: string | null;
  whatsappNumber?: string | null;
  showFloatingWhatsapp?: boolean;
  announcementBarEnabled?: boolean | null;
  announcementBarText?: string | null;
  subscriptionSectionEnabled?: boolean | null;
};

export function AppChrome({
  children,
  instagramUrl,
  contactEmail,
  whatsappNumber,
  showFloatingWhatsapp,
  announcementBarEnabled,
  announcementBarText,
  subscriptionSectionEnabled,
}: AppChromeProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");
  const isTransferRoute = pathname.startsWith("/checkout/transfer/");
  const hideHeader = isAdminRoute || isTransferRoute;
  const hideFooter = isAdminRoute || isTransferRoute;
  const hideFloatingWhatsapp = isAdminRoute || isTransferRoute;

  return (
    <>
      <TabTitleNudge />
      <WelcomePopup />
      {hideHeader ? null : (
        <SiteHeader
          announcementBarEnabled={announcementBarEnabled}
          announcementBarText={announcementBarText}
          subscriptionSectionEnabled={subscriptionSectionEnabled}
        />
      )}
      <main>{children}</main>
      {hideFooter ? null : (
        <>
          <SiteFooter
            instagramUrl={instagramUrl ?? undefined}
            contactEmail={contactEmail ?? undefined}
            whatsappNumber={whatsappNumber ?? undefined}
          />
          {showFloatingWhatsapp && whatsappNumber && !hideFloatingWhatsapp ? (
            <FloatingWhatsapp
              phone={whatsappNumber}
              message="Hola! Quiero consultar por las barritas de IQ Kids."
            />
          ) : null}
        </>
      )}
    </>
  );
}
