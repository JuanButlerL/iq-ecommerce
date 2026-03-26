import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Card } from "@/components/ui/card";
import { getStoreSettings } from "@/features/settings/queries";
import { buildWhatsappUrl } from "@/lib/utils/whatsapp";

export default async function ContactPage() {
  const settings = await getStoreSettings();

  return (
    <Container className="py-12 md:py-16">
      <Card className="mx-auto max-w-3xl space-y-5 p-5 md:p-8">
        <h1 className="font-display text-3xl leading-none text-brand-ink md:text-5xl">Contacto</h1>
        <p className="text-sm leading-6 text-brand-ink/70 md:text-base">
          Si necesitás ayuda con un pedido, envíos o datos bancarios, podés escribirnos por cualquiera de estos canales.
        </p>
        <div className="space-y-3 break-all text-sm text-brand-ink md:text-base sm:break-normal">
          <p>
            Email:{" "}
            <Link href={`mailto:${settings?.contactEmail}`} className="font-bold text-brand-pink">
              {settings?.contactEmail}
            </Link>
          </p>
          <p>
            WhatsApp:{" "}
            <Link
              href={buildWhatsappUrl(settings?.whatsappNumber ?? "", "Hola! Quiero consultar por las barritas de IQ Kids.")}
              className="font-bold text-brand-pink"
            >
              {settings?.whatsappNumber}
            </Link>
          </p>
          <p>
            Instagram:{" "}
            <Link href={settings?.instagramUrl ?? "#"} className="font-bold text-brand-pink">
              {settings?.instagramUrl}
            </Link>
          </p>
        </div>
      </Card>
    </Container>
  );
}
