import Link from "next/link";
import type { ReactNode } from "react";
import { ShoppingCart } from "lucide-react";

import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import type { WholesaleContent } from "@/features/wholesale/content";
import { buildWhatsappUrl } from "@/lib/utils/whatsapp";

type WholesaleContactProps = {
  whatsappNumber: string;
  content: WholesaleContent["contact"];
};

function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-brand-ink/50">
      <span className="h-px flex-1 bg-brand-ink/10" />
      {children}
      <span className="h-px flex-1 bg-brand-ink/10" />
    </div>
  );
}

// El alta de clientes vive en /mayoristas/registro; acá solo se invita a registrarse, comprar o escribir.
export function WholesaleContact({ whatsappNumber, content }: WholesaleContactProps) {
  return (
    <div className="mx-auto max-w-[680px]">
      <div className="rounded-[2rem] bg-white p-5 shadow-card sm:p-10">
        <h3 className="font-display text-3xl leading-none text-brand-ink">{content.leadTitle}</h3>
        {content.leadDescription ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-brand-ink/60">{content.leadDescription}</p> : null}
        <Link
          href="/mayoristas/registro"
          className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-full bg-brand-pink px-6 text-base font-extrabold text-white shadow-soft transition hover:bg-[#ea737d]"
        >
          Registrar mi negocio →
        </Link>
        <p className="mt-2 text-center text-xs text-brand-ink/50">Te registrás en un minuto y comprás en el momento.</p>

        <Divider>o si ya sos cliente</Divider>
        <a
          href="#productos"
          className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-brand-pink bg-[#fff6f7] px-4 py-3.5 text-sm font-extrabold text-brand-ink transition hover:bg-brand-pinkSoft/50"
        >
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          Ver precios y hacer el pedido online
        </a>
        <p className="mt-2 text-center text-xs text-brand-ink/50">Te identificás con tu email y CUIT.</p>

        <Divider>o contactanos directo</Divider>
        <a
          href={buildWhatsappUrl(whatsappNumber, "Hola! Me interesa vender iQ Kids en mi negocio.")}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-3.5 text-sm font-extrabold text-white transition hover:brightness-95"
        >
          <WhatsappIcon className="h-5 w-5" />
          Escribinos por WhatsApp
        </a>
        <p className="mt-3 text-center text-xs text-brand-ink/50">Te respondemos en menos de 24 horas · Sin compromiso de compra</p>
      </div>
    </div>
  );
}
