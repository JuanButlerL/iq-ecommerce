import { z } from "zod";

export const wholesaleProductSchema = z
  .object({
  name: z.string().trim().min(1, "Completá el nombre.").max(120, "Nombre: máximo 120 caracteres."),
  description: z.string().trim().max(400, "Descripción: máximo 400 caracteres."),
  imageUrl: z.string().trim().max(500),
  imageAlt: z.string().trim().max(200, "Texto alternativo: máximo 200 caracteres."),
  priceArs: z
    .number({ invalid_type_error: "El precio debe ser un número." })
    .int("El precio va sin centavos.")
    .min(1, "Cargá el precio por display.")
    .max(10_000_000, "Revisá el precio."),
  unitsPerDisplay: z.number().int().min(1, "Unidades por display: al menos 1.").max(500),
  active: z.boolean(),
  soldOut: z.boolean(),
  productId: z.string().uuid().nullable(),
  })
  // The order reaches the sheet and the operations app through the linked store product.
  .refine((data) => !data.active || Boolean(data.productId), {
    message: "Para mostrarlo en /mayoristas, elegí el producto de la tienda al que corresponde.",
    path: ["productId"],
  });

export const wholesaleProductOrderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export type WholesaleProductInput = z.infer<typeof wholesaleProductSchema>;
