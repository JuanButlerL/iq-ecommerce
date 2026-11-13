import type { WholesaleContent } from "@/features/wholesale/content";

// Pestañas de "Landing" en el grupo Mayorista del admin. Todas editan el mismo JSON de wholesale_page,
// cada una solo las claves que le corresponden. Productos, precios y mínimos no viven acá: son tablas propias.
export const WHOLESALE_ADMIN_SECTIONS = [
  {
    id: "general",
    href: "/admin/mayoristas/landing",
    label: "General",
    title: "General y portada",
    description: "Publicación, SEO, WhatsApp, barra superior, portada y números destacados.",
    keys: ["enabled", "seoTitle", "seoDescription", "whatsappNumber", "topbar", "hero", "stats"],
  },
  {
    id: "secciones",
    href: "/admin/mayoristas/landing/secciones",
    label: "Secciones",
    title: "Secciones visibles",
    description: "Elegí qué secciones se muestran en /mayoristas. Apagar una no borra su contenido: la podés volver a prender cuando quieras.",
    keys: ["sections"],
  },
  {
    id: "productos",
    href: "/admin/mayoristas/landing/productos",
    label: "Productos",
    title: "Sección de productos",
    description: "Títulos de la sección. Los productos, fotos y precios se cargan en Mayorista > Productos y precios.",
    keys: ["products"],
  },
  {
    id: "contenido",
    href: "/admin/mayoristas/landing/contenido",
    label: "Contenido",
    title: "Contenido",
    description: "Para quién es, por qué funciona en el punto de venta y los pasos para empezar.",
    keys: ["profiles", "reasons", "steps"],
  },
  {
    id: "condiciones",
    href: "/admin/mayoristas/landing/condiciones",
    label: "Condiciones",
    title: "Bloque de condiciones",
    description: "Tarjetas de condiciones de compra que se muestran en la página.",
    keys: ["conditions"],
  },
  {
    id: "pedido",
    href: "/admin/mayoristas/landing/pedido",
    label: "Formulario y pedido",
    title: "Formulario y pedido rápido",
    description: "Textos del contacto y opciones del formulario. El pedido rápido usa los productos y el mínimo del admin mayorista.",
    keys: ["contact"],
  },
  {
    id: "testimonios",
    href: "/admin/mayoristas/landing/testimonios",
    label: "Testimonios",
    title: "Testimonios",
    description: "Opiniones de comercios y familias. Sin testimonios, la sección no se muestra.",
    keys: ["testimonials"],
  },
  {
    id: "preguntas",
    href: "/admin/mayoristas/landing/preguntas-frecuentes",
    label: "Preguntas frecuentes",
    title: "Preguntas frecuentes",
    description: "Las preguntas del final de la página mayorista (son distintas de las de la tienda).",
    keys: ["faq"],
  },
] as const satisfies readonly {
  id: string;
  href: string;
  label: string;
  title: string;
  description: string;
  keys: readonly (keyof WholesaleContent)[];
}[];

export type WholesaleAdminSectionId = (typeof WHOLESALE_ADMIN_SECTIONS)[number]["id"];

export function getWholesaleAdminSection(id: string) {
  return WHOLESALE_ADMIN_SECTIONS.find((section) => section.id === id || section.href.endsWith(`/${id}`)) ?? null;
}
