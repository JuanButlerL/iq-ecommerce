import { z } from "zod";

const text = (field: string, max: number) =>
  z.string().trim().max(max, `${field}: máximo ${max} caracteres.`);

const requiredText = (field: string, max: number) =>
  text(field, max).min(1, `${field}: no puede quedar vacío.`);

const list = <T extends z.ZodTypeAny>(item: T, field: string, max: number) =>
  z.array(item).max(max, `${field}: máximo ${max} elementos.`);

const price = (field: string) =>
  z.coerce
    .number({ invalid_type_error: `${field}: ingresá un número.` })
    .int(`${field}: sin decimales.`)
    .min(0, `${field}: no puede ser negativo.`)
    .max(100_000_000, `${field}: valor demasiado alto.`);

// Internal paths ("/mayoristas/x.jpg", "/uploads/...") or absolute http(s) URLs.
const imageUrl = z
  .string()
  .trim()
  .max(500, "Imagen: máximo 500 caracteres.")
  .refine((value) => value.startsWith("/") || /^https?:\/\//i.test(value), {
    message: "Subí una imagen para cada producto.",
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

export const wholesaleContentSchema = z.object({
  enabled: z.boolean(),
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
        price: price("Condiciones · precio"),
        priceUnit: text("Condiciones · unidad del precio", 60),
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
    // Con default para no invalidar contenido guardado antes de que existieran estos campos.
    orderEnabled: z.boolean().default(false),
    orderComingSoonText: text("Pedido rápido · texto de próximamente", 300).default("Muy pronto vas a poder armar tu pedido desde acá. Mientras tanto, escribinos por WhatsApp y lo cargamos por vos."),
    orderTitle: requiredText("Pedido rápido · título", 80),
    orderDescription: text("Pedido rápido · descripción", 300),
    minDisplays: z.coerce
      .number({ invalid_type_error: "Pedido mínimo: ingresá un número." })
      .int("Pedido mínimo: sin decimales.")
      .min(1, "Pedido mínimo: al menos 1 display.")
      .max(10_000, "Pedido mínimo: valor demasiado alto."),
    orderItems: list(
      z.object({ name: requiredText("Pedido rápido · producto", 60), price: price("Pedido rápido · precio") }),
      "Pedido rápido · productos",
      12,
    ).min(1, "Cargá al menos un producto en el pedido rápido."),
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
