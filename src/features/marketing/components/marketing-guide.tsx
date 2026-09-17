import { Card } from "@/components/ui/card";

type GuideSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  code?: string;
};

// This is bundled with the application so the guide is available in production.
// Keep it aligned with docs/marketing-atribucion.md whenever Marketing changes.
const guideSections: GuideSection[] = [
  {
    title: "Qué responde este panel",
    paragraphs: [
      "Marketing muestra cómo llegó una persona, cuándo dejó su email o compró y qué impactos tuvo antes de convertir. Es la trazabilidad propia dentro de IQ Kids.",
      "Complementa Google Analytics, Meta, Google Ads y Mercado Pago. No los reemplaza.",
    ],
  },
  {
    title: "Cómo leer el panel",
    paragraphs: ["Usá el período y los filtros de canal, plataforma y búsqueda antes de tomar decisiones."],
    bullets: [
      "Embudo: sesiones, emails captados, pedidos creados y compras confirmadas.",
      "Canales: compará volumen, conversión e ingreso atribuido de Meta, Google y el resto.",
      "Campañas que convierten: campañas para proteger, escalar o replicar.",
      "Tráfico sin compra: campañas con al menos cinco sesiones y sin compras atribuidas para investigar antes de pausar.",
    ],
  },
  {
    title: "Origen de una visita",
    paragraphs: ["La web prioriza UTMs y click IDs confiables. Si no existen, analiza el referrer. Si tampoco hay una señal útil, clasifica la visita como Direct."],
    bullets: [
      "META y GOOGLE: tráfico pago con una señal explícita de pauta.",
      "ORGANIC: búsquedas o descubrimiento no pago.",
      "EMAIL, WHATSAPP y REFERRAL: tráfico identificado desde esos canales.",
      "DIRECT: entradas sin UTM ni referrer útil; no siempre representa tráfico directo puro.",
    ],
  },
  {
    title: "First touch, last touch y asistencias",
    paragraphs: ["First touch es la primera sesión conocida de un email. Last touch es la última sesión registrada antes de la compra. First paid y last paid aplican el mismo criterio sólo sobre visitas pagas."],
    bullets: [
      "Las campañas asistidas participaron del recorrido, pero no necesariamente cerraron la venta.",
      "El journey resume la secuencia de sesiones conocida antes de cada pedido.",
      "Una sesión posterior nunca modifica la atribución histórica de una compra anterior.",
    ],
  },
  {
    title: "UTMs obligatorias para pauta",
    paragraphs: ["Sin UTMs consistentes se conserva el origen detectado, pero no se puede asegurar campaña, conjunto ni anuncio."],
    code: "Meta: utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}\nGoogle: utm_source=google&utm_medium=cpc&utm_campaign={{campaignname}}&utm_term={{keyword}}&utm_content={{creative}}",
  },
  {
    title: "Exportaciones",
    paragraphs: ["Ventas atribuidas descarga una fila por compra confirmada con first touch, last touch, asistencias y recorrido. Contactos y embudo descarga una fila por email con su historia de captación, eventos y compras."],
  },
  {
    title: "Google Ads y ventas de la web",
    paragraphs: ["Las compras confirmadas de IQ Kids incluyen todas las fuentes. Las conversiones de Google Ads sólo incluyen las compras que Google atribuye según su ventana y modelo. Compará Google Ads contra el subconjunto GOOGLE del export de ventas atribuidas, con mismo período, zona horaria, moneda y definición de conversión."],
  },
  {
    title: "Límites a tener presentes",
    paragraphs: ["La continuidad puede perderse si una persona cambia de navegador o dispositivo sin identificarse. La calidad de la lectura depende de que las campañas salgan correctamente etiquetadas."],
  },
];

function InlineCode({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={`${part}-${index}`} className="rounded bg-brand-ink/7 px-1.5 py-0.5 font-mono text-[0.82em] text-brand-ink">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

export function MarketingGuide() {
  return (
    <article className="space-y-9">
      {guideSections.map((section) => (
        <section key={section.title} className="border-b border-brand-ink/10 pb-8 last:border-0 last:pb-0">
          <h2 className="font-display text-3xl text-brand-ink md:text-4xl">{section.title}</h2>
          <div className="mt-3 space-y-3">
            {section.paragraphs.map((paragraph) => <p key={paragraph} className="max-w-4xl text-sm leading-7 text-brand-ink/70 md:text-base"><InlineCode text={paragraph} /></p>)}
          </div>
          {section.bullets ? <ul className="mt-4 ml-5 list-disc space-y-2 text-sm leading-6 text-brand-ink/70 md:text-base">{section.bullets.map((bullet) => <li key={bullet}><InlineCode text={bullet} /></li>)}</ul> : null}
          {section.code ? <pre className="mt-4 overflow-x-auto rounded-2xl bg-brand-ink p-4 text-xs leading-6 text-white"><code>{section.code}</code></pre> : null}
        </section>
      ))}
    </article>
  );
}

export function MarketingGuideNotice() {
  return <Card className="border-brand-pink/20 bg-[#fff7f5] p-4 text-sm leading-6 text-brand-ink/70">La guía se publica dentro de la aplicación y se mantiene alineada con <code className="rounded bg-white px-1.5 py-0.5 text-xs text-brand-ink">docs/marketing-atribucion.md</code>. Cada mejora funcional de Marketing actualiza ambos contenidos en el mismo cambio.</Card>;
}
