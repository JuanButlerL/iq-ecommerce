"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { FloatingWhatsapp } from "@/components/layout/floating-whatsapp";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

type AppChromeProps = {
  children: ReactNode;
  instagramUrl?: string | null;
  contactEmail?: string | null;
  whatsappNumber?: string | null;
  showFloatingWhatsapp?: boolean;
};

export function AppChrome({
  children,
  instagramUrl,
  contactEmail,
  whatsappNumber,
  showFloatingWhatsapp,
}: AppChromeProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");
  const isTransferRoute = pathname.startsWith("/checkout/transfer/");
  const hideHeader = isAdminRoute || isTransferRoute;
  const hideFooter = isAdminRoute || isTransferRoute;
  const hideFloatingWhatsapp = isAdminRoute || isTransferRoute;

  return (
    <>
      {hideHeader ? null : <SiteHeader />}
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
