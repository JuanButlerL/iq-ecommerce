import { z } from "zod";

const reservedSlugs = new Set([
  "admin",
  "api",
  "carrito",
  "checkout",
  "contacto",
  "politicas",
  "productos",
  "uploads",
  "_next",
  "favicon.ico",
  "icon.svg",
]);

export const shortLinkSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Usa solo letras, numeros y guiones. No puede empezar ni terminar con guion.")
    .refine((value) => !reservedSlugs.has(value), "Ese link esta reservado por la web."),
  targetUrl: z.string().trim().url().max(2000),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  active: z.boolean().default(true),
});
