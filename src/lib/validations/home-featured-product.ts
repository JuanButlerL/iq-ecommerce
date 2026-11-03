import { z } from "zod";

export const MAX_HOME_FEATURED_SLOTS = 20;

export const homeFeaturedProductSlotSchema = z.object({
  productId: z.string({ required_error: "Elegí un producto para cada lugar." }).uuid("Elegí un producto para cada lugar."),
  eyebrow: z.string().trim().min(2, "El eyebrow debe tener al menos 2 caracteres.").max(120),
  title: z.string().trim().min(4, "El título debe tener al menos 4 caracteres.").max(140),
  description: z.string().trim().min(8, "La descripción debe tener al menos 8 caracteres.").max(280),
  quote: z.string().trim().max(280).optional().or(z.literal("")),
  buttonLabel: z.string().trim().min(2, "El texto del botón debe tener al menos 2 caracteres.").max(40),
});

// Slots are saved as an ordered list: their position in the array is the order on the home.
export const homeFeaturedProductsSchema = z.object({
  slots: z
    .array(homeFeaturedProductSlotSchema)
    .min(1, "Tiene que haber al menos un producto en el home.")
    .max(MAX_HOME_FEATURED_SLOTS, `Podés destacar hasta ${MAX_HOME_FEATURED_SLOTS} productos.`),
});

export type HomeFeaturedProductSlotInput = z.infer<typeof homeFeaturedProductSlotSchema>;
