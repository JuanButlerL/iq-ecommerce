import { z } from "zod";

const optionalText = (field: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${field}: máximo ${max} caracteres.`)
    .optional()
    .or(z.literal(""));

// Internal paths ("/productos/x", "/#productos"), anchors on the same page ("#productos") or absolute http(s) URLs.
const linkUrl = z
  .string()
  .trim()
  .max(300, "Link del botón: máximo 300 caracteres.")
  .refine((value) => value === "" || value.startsWith("/") || value.startsWith("#") || /^https?:\/\//i.test(value), {
    message: "El link del botón debe empezar con /, # o http(s)://",
  });

// <input type="datetime-local"> value ("2026-11-01T09:00"), read as Argentina time.
const argentinaDateTime = (field: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, `${field}: fecha y hora inválidas.`)
    .optional()
    .or(z.literal(""));

const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido.");
const percent = z.coerce.number().min(0).max(100);
const buttonSize = z.coerce.number().min(1).max(10);

export const slideButtonSchema = z.object({
  label: z.string().trim().min(1, "Escribí el texto del botón.").max(60, "Texto del botón: máximo 60 caracteres."),
  url: linkUrl.refine((value) => value !== "", { message: "Cargá el link del botón." }),
  bgColor: hexColor,
  textColor: hexColor,
  outline: z.boolean().default(false),
  shape: z.enum(["pill", "rounded"]).default("rounded"),
  x: percent,
  y: percent,
  size: buttonSize,
  mobileX: percent,
  mobileY: percent,
  mobileSize: buttonSize,
});

export const homeSlideFormSchema = z
  .object({
    eyebrow: optionalText("Encabezado", 60),
    // Optional: promo banners often carry their text inside the image.
    title: optionalText("Título", 160),
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
    imageOverlay: z.boolean().default(true),
    fitImage: z.boolean().default(false),
    overlayButton: slideButtonSchema.nullable().optional(),
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
