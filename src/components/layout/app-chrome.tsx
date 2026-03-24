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

  return (
    <>
      {isAdminRoute ? null : <SiteHeader />}
      <main>{children}</main>
      {isAdminRoute ? null : (
        <>
          <SiteFooter
            instagramUrl={instagramUrl ?? undefined}
            contactEmail={contactEmail ?? undefined}
            whatsappNumber={whatsappNumber ?? undefined}
          />
          {showFloatingWhatsapp && whatsappNumber ? (
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
