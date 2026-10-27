import { z } from "zod";

export const faqFormSchema = z.object({
  question: z.string().trim().min(5, "Escribí una pregunta de al menos 5 caracteres.").max(220),
  answer: z.string().trim().min(10, "Escribí una respuesta de al menos 10 caracteres.").max(3000),
  active: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999),
});

export const faqVisibilitySchema = z.object({ enabled: z.boolean() });

export const faqContentSchema = z.object({
  eyebrow: z.string().trim().min(2).max(80),
  title: z.string().trim().min(2).max(100),
  titleAccent: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(500),
  supportTitle: z.string().trim().min(2).max(120),
  supportText: z.string().trim().min(10).max(300),
});
