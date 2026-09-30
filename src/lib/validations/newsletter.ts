import { z } from "zod";

import { NEWSLETTER_ACCENT_TONES, NEWSLETTER_STEP_MARKERS, NEWSLETTER_TIP_TONES, containsHtml, isSafeImageUrl, isSafeLinkUrl } from "@/features/newsletter/content";

const htmlMessage = "No se admite HTML. Usá **negrita**, *cursiva* y [texto](link).";

const plainText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => !containsHtml(value), htmlMessage);

const requiredText = (min: number, max: number, message: string) => plainText(max).refine((value) => value.length >= min, message);

const optionalText = (max: number) =>
  plainText(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

const linkUrl = z.string().trim().max(2000).refine(isSafeLinkUrl, "Ingresá un link válido (https://... o /ruta-del-sitio).");
const imageUrl = z.string().trim().max(2000).refine(isSafeImageUrl, "Subí una imagen para este bloque.");
const altText = z.string().trim().min(3, "Escribí un texto alternativo para cada imagen.").max(200);
const blockId = z.string().trim().min(1).max(64);

const imageSchema = z.object({ url: imageUrl, alt: altText });
const accentTone = z.enum(NEWSLETTER_ACCENT_TONES).default("pink");

export const newsletterBlockSchema = z.discriminatedUnion("type", [
  z.object({ id: blockId, type: z.literal("heading"), text: requiredText(2, 160, "Completá el título de sección.") }),
  z.object({ id: blockId, type: z.literal("paragraph"), text: requiredText(2, 5000, "Completá el párrafo.") }),
  z.object({ id: blockId, type: z.literal("image"), url: imageUrl, alt: altText, caption: optionalText(300) }),
  z.object({
    id: blockId,
    type: z.literal("imageText"),
    url: imageUrl,
    alt: altText,
    title: optionalText(160),
    text: requiredText(2, 3000, "Completá el texto del bloque imagen + texto."),
    imagePosition: z.enum(["left", "right"]),
  }),
  z.object({ id: blockId, type: z.literal("gallery"), images: z.array(imageSchema).min(2, "La galería necesita 2 o 3 imágenes.").max(3), caption: optionalText(300) }),
  z.object({
    id: blockId,
    type: z.literal("quote"),
    text: requiredText(2, 800, "Completá el texto de la cita."),
    author: optionalText(120),
    role: optionalText(240),
    tone: accentTone,
  }),
  z.object({
    id: blockId,
    type: z.literal("button"),
    label: requiredText(2, 80, "Completá el texto del botón."),
    url: linkUrl,
    note: optionalText(160),
    tone: accentTone,
  }),
  z.object({ id: blockId, type: z.literal("product"), productId: z.string().uuid("Elegí un producto."), note: optionalText(300) }),
  z.object({
    id: blockId,
    type: z.literal("tip"),
    title: optionalText(120),
    text: requiredText(2, 1500, "Completá el texto de la caja destacada."),
    tone: z.enum(NEWSLETTER_TIP_TONES),
  }),
  z.object({
    id: blockId,
    type: z.literal("stats"),
    items: z
      .array(z.object({ value: requiredText(1, 16, "Completá cada dato (ej: 35%)."), label: requiredText(2, 180, "Completá la explicación de cada dato.") }))
      .min(1)
      .max(3, "Máximo 3 datos por bloque."),
    tone: accentTone,
  }),
  z.object({
    id: blockId,
    type: z.literal("steps"),
    items: z
      .array(
        z.object({
          title: requiredText(2, 200, "Completá el título de cada paso."),
          text: plainText(1200),
          marker: z.enum(NEWSLETTER_STEP_MARKERS),
        }),
      )
      .min(1, "Agregá al menos un paso.")
      .max(10, "Máximo 10 pasos por lista."),
    tone: accentTone,
  }),
  z.object({
    id: blockId,
    type: z.literal("testimonial"),
    quote: requiredText(2, 800, "Completá el testimonio."),
    author: requiredText(2, 120, "Completá quién lo dice."),
    detail: optionalText(160),
    imageUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .nullable()
      .transform((value) => (value ? value : null))
      .refine((value) => value === null || isSafeImageUrl(value), "La foto del testimonio no es válida."),
    imageAlt: optionalText(200),
  }),
  z.object({
    id: blockId,
    type: z.literal("sources"),
    label: requiredText(2, 60, "Completá el título (ej: Fuentes)."),
    text: requiredText(2, 1500, "Completá las fuentes."),
  }),
  z.object({ id: blockId, type: z.literal("divider") }),
]);

export const newsletterFormSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3, "La URL necesita al menos 3 caracteres.")
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "La URL solo puede tener minúsculas, números y guiones."),
  title: requiredText(3, 140, "Escribí un título de al menos 3 caracteres."),
  subtitle: optionalText(220),
  excerpt: requiredText(10, 400, "Escribí un resumen de al menos 10 caracteres."),
  category: optionalText(60),
  headerTag: optionalText(80),
  coverImageUrl: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || isSafeImageUrl(value), "La portada no es válida."),
  coverImageAlt: optionalText(200),
  blocks: z.array(newsletterBlockSchema).max(60, "Máximo 60 bloques por newsletter."),
  emailSubject: requiredText(3, 120, "Escribí el asunto del mail (hasta 120 caracteres)."),
  emailPreviewText: optionalText(180),
});

export type NewsletterFormInput = z.infer<typeof newsletterFormSchema>;

// Admin-only notes: never published nor emailed, and never invalidate a test send.
export const newsletterInternalNotesSchema = z
  .string()
  .max(5000, "Las notas internas pueden tener hasta 5000 caracteres.")
  .optional()
  .nullable()
  .transform((value) => (value?.trim() ? value.trim() : null));

export const newsletterImportSchema = z.object({
  items: z
    .array(z.object({ content: z.unknown(), internalNotes: z.unknown() }))
    .min(1, "El archivo no tiene newsletters para importar.")
    .max(30, "Se pueden importar hasta 30 newsletters por vez."),
});

export const SEND_CONFIRMATION_WORD = "ENVIAR";

// "Send now" uses the SERVER clock, so a wrong clock on the admin's computer can
// never shift or block a send. Scheduled dates are absolute instants (UTC) built
// from the Buenos Aires wall time the admin picked.
export const newsletterScheduleSchema = z
  .object({
    sendNow: z.boolean().optional(),
    scheduledAt: z.string().datetime({ message: "Elegí una fecha y hora válidas." }).optional(),
    confirmation: z.literal(SEND_CONFIRMATION_WORD, { errorMap: () => ({ message: `Escribí ${SEND_CONFIRMATION_WORD} para confirmar.` }) }),
  })
  .refine((value) => value.sendNow === true || Boolean(value.scheduledAt), { message: "Elegí una fecha y hora, o \"Enviar ahora\"." });

export const newsletterConfirmSchema = z.object({
  confirmation: z.literal(SEND_CONFIRMATION_WORD, { errorMap: () => ({ message: `Escribí ${SEND_CONFIRMATION_WORD} para confirmar.` }) }),
});

export const newsletterVisibilitySchema = z.object({ webVisible: z.boolean() });

export const newsletterReconcileSchema = z.object({
  outcome: z.enum(["sent", "error", "retry"]),
  confirmation: z.literal(SEND_CONFIRMATION_WORD, { errorMap: () => ({ message: `Escribí ${SEND_CONFIRMATION_WORD} para confirmar.` }) }),
});

const emailList = z
  .array(z.string().trim().toLowerCase().email("Hay una casilla de prueba inválida."))
  .max(5, "Máximo 5 casillas de prueba.")
  .transform((values) => [...new Set(values)]);

export const newsletterSettingsSchema = z.object({
  sectionEnabled: z.boolean(),
  eyebrow: optionalText(80),
  title: optionalText(120),
  description: optionalText(400),
  senderName: requiredText(2, 60, "Completá el nombre del remitente."),
  fromEmail: z.string().trim().toLowerCase().email("La casilla del remitente no es válida."),
  replyToEmail: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || z.string().email().safeParse(value).success, "La casilla de respuesta no es válida."),
  testRecipients: emailList,
  dailyLimit: z.coerce.number().int().min(1, "El límite diario tiene que ser al menos 1.").max(5000),
});

export const newsletterSubscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email("Ingresá un email válido.").max(254),
  consent: z.literal(true, { errorMap: () => ({ message: "Marcá la casilla para suscribirte." }) }),
  // Honeypot: real people never fill it.
  website: z.string().max(0).optional(),
});
