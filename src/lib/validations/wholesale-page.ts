import { z } from "zod";

const text = (field: string, max: number) =>
  z.string().trim().max(max, `${field}: máximo ${max} caracteres.`);

const requiredText = (field: string, max: number) =>
  text(field, max).min(1, `${field}: no puede quedar vacío.`);

const list = <T extends z.ZodTypeAny>(item: T, field: string, max: number) =>
  z.array(item).max(max, `${field}: máximo ${max} elementos.`);

// Internal paths ("/mayoristas/x.jpg", "/uploads/...") or absolute http(s) URLs.
const imageUrl = z
  .string()
  .trim()
  .max(500, "Imagen: máximo 500 caracteres.")
  .refine((value) => value.startsWith("/") || /^https?:\/\//i.test(value), {
    message: "Subí una imagen para cada producto.",
  });

// Imagen opcional (portada y carrusel): vacía o una ruta/URL válida.
const optionalImageUrl = z
  .string()
  .trim()
  .max(500, "Imagen: máximo 500 caracteres.")
  .refine((value) => value === "" || value.startsWith("/") || /^https?:\/\//i.test(value), {
    message: "La imagen no es válida: subila de nuevo.",
  })
  .default("");

// Link de un botón del carrusel: vacío, una ruta interna ("/...", "#...") o una URL http(s).
const optionalLink = (field: string) =>
  text(field, 300)
    .refine((value) => value === "" || value.startsWith("/") || value.startsWith("#") || /^https?:\/\//i.test(value), {
      message: `${field}: usá una ruta que empiece con “/” o una dirección que empiece con https://.`,
    })
    .default("");

const heroSlide = z.object({
  imageUrl: optionalImageUrl.refine((value) => value !== "", { message: "Carrusel: subí una imagen para cada slide." }),
  mobileImageUrl: optionalImageUrl,
  imageAlt: text("Carrusel · texto alternativo", 160).default(""),
  eyebrow: text("Carrusel · encabezado", 80).default(""),
  title: text("Carrusel · título", 160).default(""),
  description: text("Carrusel · descripción", 500).default(""),
  ctaLabel: text("Carrusel · texto del botón", 60).default(""),
  ctaUrl: optionalLink("Carrusel · link del botón"),
  overlay: z.boolean().default(true),
});

const sectionIntro = (section: string) => ({
  eyebrow: text(`${section} · encabezado`, 80),
  title: requiredText(`${section} · título`, 160),
  description: text(`${section} · descripción`, 500),
});

const iconCard = (section: string) =>
  z.object({
    icon: text(`${section} · ícono`, 16),
    title: requiredText(`${section} · título`, 80),
    description: text(`${section} · descripción`, 400),
  });

// Contenido guardado antes de que existieran los interruptores: cada sección toma su valor por defecto
// (los mismos que DEFAULT_WHOLESALE_SECTION_VISIBILITY; el bloque de contacto arranca apagado).
const sectionVisibility = z
  .object({
    stats: z.boolean().default(true),
    products: z.boolean().default(true),
    profiles: z.boolean().default(true),
    reasons: z.boolean().default(true),
    conditions: z.boolean().default(true),
    steps: z.boolean().default(true),
    testimonials: z.boolean().default(true),
    contact: z.boolean().default(false),
    faq: z.boolean().default(true),
  })
  .default({});

export const wholesaleContentSchema = z.object({
  enabled: z.boolean(),
  sections: sectionVisibility,
  accessPasswordHash: z.string().max(300).default(""),
  seoTitle: requiredText("Título SEO", 70),
  seoDescription: text("Descripción SEO", 300),
  whatsappNumber: text("WhatsApp", 30).refine((value) => value === "" || /^[+\d\s()-]{8,30}$/.test(value), {
    message: "WhatsApp: usá solo números (ej: 5491112345678).",
  }),
  topbar: text("Barra superior", 160),
  hero: z.object({
    eyebrow: text("Portada · encabezado", 80),
    title: requiredText("Portada · título", 160),
    titleAccent: text("Portada · título destacado", 160),
    description: text("Portada · descripción", 500),
    chips: list(z.object({ label: requiredText("Portada · etiqueta", 40), accent: z.boolean() }), "Portada · etiquetas", 8),
    primaryCta: requiredText("Portada · botón principal", 60),
    secondaryCta: requiredText("Portada · botón secundario", 60),
    // Los campos nuevos tienen valor por defecto para que el contenido ya guardado siga siendo válido.
    backgroundImageUrl: optionalImageUrl,
    backgroundMobileImageUrl: optionalImageUrl,
    slides: list(heroSlide, "Carrusel", 8).default([]),
    intervalSeconds: z.number().int().min(3, "Carrusel: mínimo 3 segundos.").max(30, "Carrusel: máximo 30 segundos.").default(7),
  }),
  stats: list(z.object({ value: requiredText("Números · valor", 20), label: text("Números · texto", 120) }), "Números", 6),
  products: z.object({
    ...sectionIntro("Productos"),
    items: list(
      z.object({
        name: requiredText("Productos · nombre", 60),
        description: text("Productos · descripción", 200),
        imageUrl,
        imageAlt: text("Productos · texto alternativo", 160),
      }),
      "Productos",
      12,
    ),
  }),
  profiles: z.object({ ...sectionIntro("Perfiles"), items: list(iconCard("Perfiles"), "Perfiles", 12) }),
  reasons: z.object({ ...sectionIntro("Por qué funciona"), items: list(iconCard("Por qué funciona"), "Por qué funciona", 12) }),
  conditions: z.object({
    ...sectionIntro("Condiciones"),
    plans: list(
      z.object({
        icon: text("Condiciones · ícono", 16),
        title: requiredText("Condiciones · nombre del plan", 60),
        subtitle: text("Condiciones · bajada", 160),
        highlighted: z.boolean(),
        rows: list(
          z.object({
            label: requiredText("Condiciones · dato", 40),
            value: requiredText("Condiciones · valor", 120),
            note: text("Condiciones · aclaración", 120),
          }),
          "Condiciones · filas",
          10,
        ),
        cta: requiredText("Condiciones · botón", 60),
      }),
      "Planes",
      3,
    ),
  }),
  steps: z.object({
    ...sectionIntro("Pasos"),
    items: list(z.object({ title: requiredText("Pasos · título", 80), description: text("Pasos · descripción", 400) }), "Pasos", 6),
  }),
  testimonials: z.object({
    ...sectionIntro("Testimonios"),
    items: list(
      z.object({
        tag: text("Testimonios · etiqueta", 40),
        quote: requiredText("Testimonios · frase", 600),
        name: requiredText("Testimonios · nombre", 80),
        meta: text("Testimonios · detalle", 120),
      }),
      "Testimonios",
      9,
    ),
  }),
  contact: z.object({
    ...sectionIntro("Contacto"),
    leadTitle: requiredText("Formulario · título", 80),
    leadDescription: text("Formulario · descripción", 300),
    leadNotificationEmails: list(
      z.string().trim().toLowerCase().email("Aviso por email: hay una dirección inválida."),
      "Aviso por email",
      5,
    ).default(["nicolas@ikifoods.com.ar"]),
    businessTypes: list(requiredText("Tipos de negocio", 60), "Tipos de negocio", 20).min(1, "Cargá al menos un tipo de negocio."),
    monthlyVolumes: list(requiredText("Cantidad estimada", 60), "Cantidad estimada", 10),
  }),
  faq: z.object({
    ...sectionIntro("Preguntas frecuentes"),
    items: list(
      z.object({ question: requiredText("Preguntas · pregunta", 200), answer: requiredText("Preguntas · respuesta", 1500) }),
      "Preguntas frecuentes",
      30,
    ),
  }),
});
