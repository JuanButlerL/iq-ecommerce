import Link from "next/link";
import { Instagram, Mail } from "lucide-react";

import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { Container } from "@/components/layout/container";

type SiteFooterProps = {
  instagramUrl?: string | null;
  contactEmail?: string;
  whatsappNumber?: string;
};

export function SiteFooter({ instagramUrl, contactEmail, whatsappNumber }: SiteFooterProps) {
  return (
    <footer className="border-t border-brand-ink/10 bg-white py-8 md:py-10">
      <Container className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-2xl text-brand-pink">IQ Kids</p>
          <p className="max-w-md text-sm leading-6 text-brand-ink/70">
            Barritas ricas, simples y con ingredientes naturales para acompañar a los chicos todos los dias.
          </p>
          <p className="mt-2 text-sm font-semibold text-brand-pink">Pensado para sus recreos, elegido por sus familias.</p>
        </div>
        <div className="flex flex-col gap-3 break-all text-sm text-brand-ink/70 sm:break-normal">
          {instagramUrl ? (
            <Link href={instagramUrl} target="_blank" className="inline-flex items-center gap-2 hover:text-brand-pink">
              <Instagram className="h-4 w-4" />
              Instagram
            </Link>
          ) : null}
          {contactEmail ? (
            <Link href={`mailto:${contactEmail}`} className="inline-flex items-center gap-2 hover:text-brand-pink">
              <Mail className="h-4 w-4" />
              {contactEmail}
            </Link>
          ) : null}
          {whatsappNumber ? (
            <Link
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              className="inline-flex items-center gap-2 hover:text-brand-pink"
            >
              <WhatsappIcon className="h-4 w-4" />
              WhatsApp
            </Link>
          ) : null}
        </div>
      </Container>
    </footer>
  );
}
