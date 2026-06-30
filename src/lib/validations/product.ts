import { ProductColorTheme } from "@prisma/client";
import { z } from "zod";

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9A-Fa-f]{6})$/, "Ingresa un color HEX valido, por ejemplo #F48991.");

export const productFormSchema = z.object({
  name: z.string().min(3).max(120),
  slug: z.string().min(3).max(140),
  homeVarietyLabel: z.string().trim().min(2).max(40).optional().or(z.literal("")),
  shortDescription: z.string().trim().min(10, "La descripcion corta debe tener al menos 10 caracteres.").max(1000, "La descripcion corta no puede superar los 1000 caracteres."),
  longDescription: z.string().min(20).max(8000),
  priceArs: z.coerce.number().int().min(1),
  colorTheme: z.nativeEnum(ProductColorTheme),
  visualAccentHex: hexColorSchema.optional().or(z.literal("")),
  visualSurfaceHex: hexColorSchema.optional().or(z.literal("")),
  visualTextHex: hexColorSchema.optional().or(z.literal("")),
  active: z.boolean().default(true),
  visible: z.boolean().default(true),
  manualSoldOut: z.boolean().default(false),
  featured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;
