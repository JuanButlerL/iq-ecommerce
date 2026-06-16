import { z } from "zod";

export const testimonialFormSchema = z.object({
  name: z.string().trim().min(2).max(80),
  roleLabel: z.string().trim().max(140).optional().or(z.literal("")),
  quote: z.string().trim().min(8).max(500),
  avatarLabel: z.string().trim().max(8).optional().or(z.literal("")),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export type TestimonialFormInput = z.infer<typeof testimonialFormSchema>;
