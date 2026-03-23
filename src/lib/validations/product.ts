import { ProductColorTheme } from "@prisma/client";
import { z } from "zod";

export const productFormSchema = z.object({
  name: z.string().min(3).max(120),
  slug: z.string().min(3).max(140),
  shortDescription: z.string().min(10).max(240),
  longDescription: z.string().min(20).max(4000),
  priceArs: z.coerce.number().int().min(1),
  colorTheme: z.nativeEnum(ProductColorTheme),
  active: z.boolean().default(true),
  visible: z.boolean().default(true),
  manualSoldOut: z.boolean().default(false),
  featured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;
