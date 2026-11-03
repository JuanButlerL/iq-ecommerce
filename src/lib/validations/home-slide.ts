import { z } from "zod";

const optionalText = (field: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${field}: máximo ${max} caracteres.`)
    .optional()
    .or(z.literal(""));

// Internal paths ("/productos/x", "/#productos") or absolute http(s) URLs.
const linkUrl = z
  .string()
  .trim()
  .max(300, "Link del botón: máximo 300 caracteres.")
  .refine((value) => value === "" || value.startsWith("/") || /^https?:\/\//i.test(value), {
    message: "El link del botón debe empezar con / o con http(s)://",
  });

// <input type="datetime-local"> value ("2026-11-01T09:00"), read as Argentina time.
const argentinaDateTime = (field: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, `${field}: fecha y hora inválidas.`)
    .optional()
    .or(z.literal(""));

export const homeSlideFormSchema = z
  .object({
    eyebrow: optionalText("Encabezado", 60),
    title: z
      .string()
      .trim()
      .min(3, "El título debe tener al menos 3 caracteres.")
      .max(160, "Título: máximo 160 caracteres."),
    mobileTitle: optionalText("Título para celular", 80),
    subtitle: optionalText("Subtítulo", 300),
    badges: z
      .array(z.string().trim().min(1).max(40, "Cada check puede tener hasta 40 caracteres."))
      .max(5, "Podés cargar hasta 5 checks.")
      .default([]),
    ctaLabel: optionalText("Texto del botón", 80),
    ctaUrl: linkUrl.optional().or(z.literal("")),
    imageUrl: z.string().trim().min(1, "Subí una imagen para el slide.").max(500),
    mobileImageUrl: optionalText("Imagen de celular", 500),
    imageAlt: optionalText("Texto alternativo", 200),
    active: z.boolean().default(true),
    startsAt: argentinaDateTime("Fecha de inicio"),
    endsAt: argentinaDateTime("Fecha de fin"),
  })
  .refine((data) => !data.ctaLabel || Boolean(data.ctaUrl), {
    message: "Si cargás un texto de botón, también tenés que cargar el link.",
    path: ["ctaUrl"],
  })
  // Same-format strings compare chronologically.
  .refine((data) => !data.startsAt || !data.endsAt || data.endsAt > data.startsAt, {
    message: "La fecha de fin tiene que ser posterior a la de inicio.",
    path: ["endsAt"],
  });

export const homeSlideIdSchema = z.string().uuid("Orden inválido.");

export const homeSlideReorderSchema = z.object({
  slideIds: z.array(homeSlideIdSchema, { invalid_type_error: "Orden inválido." }).min(1, "Orden inválido.").max(100),
});

export const homeCarouselSettingsSchema = z.object({
  intervalSeconds: z
    .number({ invalid_type_error: "La duración debe ser un número." })
    .int("La duración debe ser un número entero de segundos.")
    .min(3, "La duración mínima es de 3 segundos.")
    .max(30, "La duración máxima es de 30 segundos."),
});

export type HomeSlideFormInput = z.infer<typeof homeSlideFormSchema>;
