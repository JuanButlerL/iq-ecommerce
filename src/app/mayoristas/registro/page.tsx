import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { WhatsappIcon } from "@/components/icons/whatsapp-icon";
import { hasWholesaleAccess } from "@/features/wholesale/access";
import { WholesalePasswordGate } from "@/features/wholesale/components/wholesale-password-gate";
import { WholesaleRegistrationForm } from "@/features/wholesale/components/wholesale-registration-form";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { getWholesaleSettings } from "@/features/wholesale/settings";
import { getStoreSettings } from "@/features/settings/queries";
import { buildWhatsappUrl } from "@/lib/utils/whatsapp";

const FALLBACK_WHATSAPP = "5491173933235";

export async function generateMetadata(): Promise<Metadata> {
  const content = await getWholesaleContent();

  return {
    title: "Registro mayorista",
    description: "Registrá tu negocio y comprá iQ Kids por mayor: precios mayoristas, pedido online y envíos a todo el país.",
    alternates: { canonical: "/mayoristas/registro" },
    robots: content.enabled && !content.accessPasswordHash ? undefined : { index: false, follow: false },
  };
}

// Destino de la pauta: registra al cliente en el maestro y lo manda a la tienda mayorista ya identificado.
export default async function WholesaleRegistrationPage() {
  const [content, settings, wholesaleSettings] = await Promise.all([getWholesaleContent(), getStoreSettings(), getWholesaleSettings()]);

  if (!content.enabled) {
    notFound();
  }

  if (!(await hasWholesaleAccess(content))) {
    return <WholesalePasswordGate />;
  }

  const whatsappNumber = content.whatsappNumber || settings?.whatsappNumber || FALLBACK_WHATSAPP;
  const paymentMethods = [
    wholesaleSettings.enableMercadoPago ? "Mercado Pago" : null,
    wholesaleSettings.enableBankTransfer ? "transferencia" : null,
    wholesaleSettings.enableEcheq ? "eCheq" : null,
  ].filter((method): method is string => Boolean(method));
  const benefits = [
    { title: "Precios mayoristas a la vista", description: "Ves el precio por display y por barrita, con IVA incluido." },
    { title: `Pedido mínimo de ${wholesaleSettings.minDisplays} displays`, description: "Combinás los sabores como quieras." },
    paymentMethods.length > 0 ? { title: "Pagás como te quede cómodo", description: `${paymentMethods.join(", ")}.` } : null,
    { title: "Envíos a todo el país", description: "A la dirección de tu negocio." },
  ].filter((benefit): benefit is { title: string; description: string } => Boolean(benefit));

  return (
    <div className="bg-[#fff6f7] px-4 pb-16 pt-10 text-brand-ink md:px-6 md:pb-24 md:pt-16">
      {/* En celular el formulario va justo después del título; en escritorio ocupa la columna derecha. */}
      <div className="mx-auto grid max-w-[1080px] gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:grid-rows-[auto_1fr] md:gap-x-12 md:gap-y-0">
        <div className="md:col-start-1 md:row-start-1 md:pt-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-brand-pink">Registro mayorista</p>
          <h1 className="mt-3 text-balance font-display text-[2.4rem] leading-[1.02] md:text-[3.4rem]">Vendé iQ Kids en tu negocio</h1>
          <p className="mt-4 text-base leading-7 text-brand-ink/70">
            Registrate en un minuto y hacé tu primer pedido online. Sin aprobaciones ni esperas: apenas terminás, entrás a la tienda mayorista.
          </p>
        </div>

        <div className="rounded-[2rem] bg-white p-5 shadow-card sm:p-10 md:col-start-2 md:row-span-2 md:row-start-1 md:self-start">
          <h2 className="font-display text-3xl leading-none">Tus datos</h2>
          <p className="mt-2 text-sm leading-6 text-brand-ink/60">Los usamos para facturarte y enviarte los pedidos. Los podés cambiar cuando quieras escribiéndonos.</p>
          <div className="mt-6">
            <WholesaleRegistrationForm businessTypes={content.contact.businessTypes} monthlyVolumes={content.contact.monthlyVolumes} />
          </div>
        </div>

        <div className="md:col-start-1 md:row-start-2 md:pt-8">
          <ul className="space-y-4">
            {benefits.map((benefit) => (
              <li key={benefit.title} className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-pink text-sm font-extrabold text-white">
                  ✓
                </span>
                <div>
                  <p className="text-base font-extrabold">{benefit.title}</p>
                  <p className="text-sm leading-6 text-brand-ink/65">{benefit.description}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-8 space-y-3 text-sm text-brand-ink/65">
            <p>
              ¿Ya te registraste?{" "}
              <Link href="/mayoristas#productos" className="font-bold text-brand-pink underline-offset-2 hover:underline">
                Hacé tu pedido
              </Link>{" "}
              con tu email y CUIT.
            </p>
            <a
              href={buildWhatsappUrl(whatsappNumber, "Hola! Quiero registrarme como cliente mayorista de iQ Kids.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-bold text-brand-ink hover:text-brand-pink"
            >
              <WhatsappIcon className="h-5 w-5 text-[#25D366]" />
              ¿Dudas? Escribinos por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
