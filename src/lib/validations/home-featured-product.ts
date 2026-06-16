import { z } from "zod";

export const homeFeaturedProductSlotSchema = z.object({
  slotOrder: z.coerce.number().int().min(1).max(4),
  productId: z.string().uuid(),
  eyebrow: z.string().trim().min(2).max(120),
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().min(8).max(280),
  quote: z.string().trim().max(280).optional().or(z.literal("")),
  buttonLabel: z.string().trim().min(2).max(40),
});

export const homeFeaturedProductsSchema = z.object({
  slots: z.array(homeFeaturedProductSlotSchema).min(4).max(4),
});

export type HomeFeaturedProductSlotInput = z.infer<typeof homeFeaturedProductSlotSchema>;
