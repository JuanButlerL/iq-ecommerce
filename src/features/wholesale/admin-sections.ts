import type { WholesaleContent } from "@/features/wholesale/content";

// Subsecciones del grupo "Mayoristas" del admin. Todas editan el mismo JSON de wholesale_page,
// cada una solo las claves que le corresponden.
export const WHOLESALE_ADMIN_SECTIONS = [
  {
    id: "general",
    href: "/admin/mayoristas",
    label: "General",
    title: "General y portada",
    description: "Publicación, SEO, WhatsApp, barra superior, portada y números destacados.",
    keys: ["enabled", "seoTitle", "seoDescription", "whatsappNumber", "topbar", "hero", "stats"],
  },
  {
    id: "productos",
    href: "/admin/mayoristas/productos",
    label: "Productos",
    title: "Productos",
    description: "Fotos y descripción de cada producto.",
    keys: ["products"],
  },
  {
    id: "contenido",
    href: "/admin/mayoristas/contenido",
    label: "Contenido",
    title: "Contenido",
    description: "Para quién es, por qué funciona en el punto de venta y los pasos para empezar.",
    keys: ["profiles", "reasons", "steps"],
  },
  {
    id: "condiciones",
    href: "/admin/mayoristas/condiciones",
    label: "Condiciones y precios",
    title: "Condiciones y precios",
    description: "Planes para comercios y distribuidores.",
    keys: ["conditions"],
  },
  {
    id: "pedido",
    href: "/admin/mayoristas/pedido",
    label: "Formulario y pedido",
    title: "Formulario y pedido rápido",
    description: "Textos del contacto, opciones del formulario y productos/precios del pedido rápido.",
    keys: ["contact"],
  },
  {
    id: "testimonios",
    href: "/admin/mayoristas/testimonios",
    label: "Testimonios",
    title: "Testimonios",
    description: "Opiniones de comercios y familias. Sin testimonios, la sección no se muestra.",
    keys: ["testimonials"],
  },
  {
    id: "preguntas",
    href: "/admin/mayoristas/preguntas-frecuentes",
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
