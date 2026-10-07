import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { getStoreSettings } from "@/features/settings/queries";
import { buildWhatsappUrl } from "@/lib/utils/whatsapp";

export const metadata: Metadata = {
  title: "Política de privacidad | IQ Kids",
  description: "Cómo IQ Kids recolecta, usa y protege tus datos personales, y cómo ejercer tus derechos.",
  alternates: { canonical: "/privacidad" },
};

const LAST_UPDATED = "6 de octubre de 2026";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-28 border-t border-brand-ink/10 pt-8">
      <h2 id={`${id}-heading`} className="font-display text-2xl leading-tight sm:text-3xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-brand-ink/75 sm:text-base">{children}</div>
    </section>
  );
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-brand-pink">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export default async function PrivacyPolicyPage() {
  const settings = await getStoreSettings();
  const storeName = settings?.storeName ?? "IQ Kids";
  const contactEmail = settings?.contactEmail;
  const whatsappNumber = settings?.whatsappNumber;

  const emailLink = contactEmail ? (
    <Link href={`mailto:${contactEmail}`} className="font-bold text-brand-pink">
      {contactEmail}
    </Link>
  ) : (
    <Link href="/contacto" className="font-bold text-brand-pink">
      nuestra página de contacto
    </Link>
  );

  return (
    <div className="min-h-screen bg-white text-brand-ink">
      <header className="mx-auto max-w-[900px] px-5 pb-6 pt-9 sm:px-8 sm:pt-12 lg:pt-14">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-brand-pink sm:text-xs">Legales</p>
        <h1 className="mt-4 font-display text-[2.3rem] leading-[1.02] sm:text-[3.15rem]">
          Política de <span className="text-brand-pink">privacidad.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-ink/65 sm:text-base sm:leading-7">
          En {storeName} cuidamos los datos que nos confiás. Acá te contamos qué información recolectamos, para qué la
          usamos, con quién la compartimos y cómo podés consultarla, corregirla o pedir que la eliminemos.
        </p>
        <p className="mt-3 text-xs text-brand-ink/50">Última actualización: {LAST_UPDATED}</p>
      </header>

      <main className="mx-auto max-w-[900px] space-y-8 px-5 pb-16 sm:px-8 lg:pb-20">
        <Section id="responsable" title="Quién es responsable de tus datos">
          <p>
            El responsable del tratamiento de los datos personales recolectados en www.iqkids.com.ar es {storeName}.
            Para cualquier consulta sobre esta política o sobre tus datos podés escribirnos a {emailLink}.
          </p>
        </Section>

        <Section id="datos" title="Qué datos recolectamos">
          <p>Solo pedimos los datos necesarios para venderte, entregarte tus productos y mantenerte informado si así lo elegís:</p>
          <List
            items={[
              <>
                <strong>Datos de tu compra:</strong> nombre y apellido, email, teléfono, dirección de entrega, CUIT o DNI si lo
                informás, notas del pedido y el detalle de los productos comprados.
              </>,
              <>
                <strong>Datos de pago:</strong> el comprobante de transferencia que subís y el estado del pago informado por
                Mercado Pago. No guardamos números de tarjeta: esos datos los procesa directamente Mercado Pago.
              </>,
              <>
                <strong>Email para comunicaciones:</strong> si te suscribís al newsletter, dejás tu email para recuperar tu
                carrito o lo cargás en un formulario del sitio.
              </>,
              <>
                <strong>Conversaciones por WhatsApp:</strong> si nos escribís o te enviamos avisos sobre tu pedido, registramos
                tu número, tu nombre de perfil y los mensajes intercambiados.
              </>,
              <>
                <strong>Datos de navegación:</strong> páginas visitadas, origen de la visita (por ejemplo, campañas o
                identificadores de anuncios como UTM, gclid o fbclid), tipo de dispositivo y navegador, obtenidos mediante
                cookies y tecnologías similares.
              </>,
            ]}
          />
        </Section>

        <Section id="finalidades" title="Para qué los usamos">
          <List
            items={[
              "Procesar, confirmar, cobrar y entregar tus pedidos.",
              "Comunicarnos con vos sobre tu compra: confirmaciones, estado del pago, despacho y entrega, por email o WhatsApp.",
              "Responder tus consultas y brindarte atención.",
              "Enviarte novedades, promociones y el newsletter, solo si te suscribiste. Podés darte de baja en cualquier momento.",
              "Recordarte un carrito que dejaste sin terminar, si nos dejaste tu email.",
              "Medir el funcionamiento del sitio y de nuestras campañas para mejorarlos.",
              "Cumplir con obligaciones legales, contables e impositivas.",
            ]}
          />
        </Section>

        <Section id="terceros" title="Con quién compartimos tus datos">
          <p>
            No vendemos tus datos personales. Los compartimos únicamente con proveedores que nos ayudan a operar la tienda,
            y solo en la medida necesaria para cada servicio:
          </p>
          <List
            items={[
              <>
                <strong>Mercado Pago:</strong> procesamiento de pagos.
              </>,
              <>
                <strong>Meta (WhatsApp, Facebook e Instagram):</strong> mensajería por WhatsApp y medición de anuncios (Meta
                Pixel y API de conversiones).
              </>,
              <>
                <strong>Google:</strong> analítica del sitio (Google Analytics y Google Tag Manager) y herramientas internas
                de gestión de pedidos.
              </>,
              <>
                <strong>Microsoft Clarity:</strong> análisis de uso del sitio.
              </>,
              <>
                <strong>Proveedores de infraestructura:</strong> alojamiento del sitio y la base de datos, almacenamiento de
                imágenes y comprobantes, y envío de emails.
              </>,
              <>
                <strong>Servicios de envío:</strong> los datos de entrega necesarios para que tu pedido llegue a destino.
              </>,
            ]}
          />
          <p>
            Algunos de estos proveedores pueden almacenar información fuera de Argentina. En esos casos trabajamos con
            empresas que aplican medidas de seguridad adecuadas. También podemos compartir datos cuando lo exija una
            autoridad competente.
          </p>
        </Section>

        <Section id="cookies" title="Cookies y tecnologías similares">
          <p>
            Usamos cookies propias y de terceros para que el sitio funcione (por ejemplo, para recordar tu carrito), para
            entender cómo se usa y para medir nuestras campañas. Podés bloquear o borrar las cookies desde la configuración
            de tu navegador; algunas funciones del sitio podrían dejar de funcionar correctamente.
          </p>
        </Section>

        <Section id="conservacion" title="Cuánto tiempo los conservamos">
          <p>
            Conservamos los datos de tus pedidos durante el tiempo necesario para gestionarlos y para cumplir con las
            obligaciones legales, contables e impositivas aplicables. Los datos usados para comunicaciones de marketing los
            conservamos mientras sigas suscripto o hasta que nos pidas eliminarlos.
          </p>
        </Section>

        <Section id="seguridad" title="Cómo protegemos tu información">
          <p>
            Aplicamos medidas técnicas y organizativas razonables para proteger tus datos: conexiones cifradas (HTTPS),
            acceso restringido al panel de administración y validación de las notificaciones que recibimos de nuestros
            proveedores. Ningún sistema es completamente infalible, pero trabajamos para mantener tu información segura.
          </p>
        </Section>

        <Section id="derechos" title="Tus derechos">
          <p>
            Podés solicitar en cualquier momento el acceso, la rectificación, la actualización o la supresión de tus datos
            personales, y oponerte a recibir comunicaciones comerciales, escribiéndonos a {emailLink}. Para darte de baja de
            nuestros emails también podés usar el enlace que figura al pie de cada uno.
          </p>
          <p>
            El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma
            gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo
            establecido en el artículo 14, inciso 3 de la Ley N° 25.326.
          </p>
          <p>
            La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la
            atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por
            incumplimiento de las normas vigentes en materia de protección de datos personales.
          </p>
        </Section>

        <Section id="eliminacion-de-datos" title="Cómo pedir la eliminación de tus datos">
          <p>Si querés que eliminemos tus datos personales, incluidos los asociados a WhatsApp:</p>
          <ol className="list-decimal space-y-2 pl-5 marker:font-bold marker:text-brand-pink">
            <li>
              Escribinos a {emailLink}
              {whatsappNumber ? (
                <>
                  {" "}
                  o por{" "}
                  <Link
                    href={buildWhatsappUrl(whatsappNumber, "Hola! Quiero solicitar la eliminación de mis datos personales.")}
                    target="_blank"
                    className="font-bold text-brand-pink"
                  >
                    WhatsApp
                  </Link>
                </>
              ) : null}{" "}
              con el asunto &quot;Eliminación de datos&quot;.
            </li>
            <li>Indicanos el email o el teléfono con el que compraste o te comunicaste con nosotros.</li>
            <li>
              Te confirmaremos la eliminación dentro de los 5 días hábiles. Solo conservaremos la información que la ley nos
              obligue a mantener, por ejemplo, los registros de facturación.
            </li>
          </ol>
        </Section>

        <Section id="menores" title="Menores de edad">
          <p>
            Nuestros productos están pensados para chicos, pero las compras deben realizarlas personas mayores de 18 años. No
            recolectamos a sabiendas datos personales de menores.
          </p>
        </Section>

        <Section id="cambios" title="Cambios en esta política">
          <p>
            Podemos actualizar esta política para reflejar cambios en el sitio o en la normativa. Publicaremos la versión
            vigente en esta página, con su fecha de última actualización.
          </p>
        </Section>
      </main>
    </div>
  );
}
