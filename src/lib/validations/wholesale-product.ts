import { z } from "zod";

import { WHOLESALE_MAX_BOX_DISPLAYS } from "@/features/wholesale/bundles";

export const wholesaleProductSchema = z
  .object({
    name: z.string().trim().min(1, "Completá el nombre.").max(120, "Nombre: máximo 120 caracteres."),
    description: z.string().trim().max(400, "Descripción: máximo 400 caracteres."),
    imageUrl: z.string().trim().max(500),
    imageAlt: z.string().trim().max(200, "Texto alternativo: máximo 200 caracteres."),
    priceArs: z
      .number({ invalid_type_error: "El precio debe ser un número." })
      .int("El precio va sin centavos.")
      .min(1, "Cargá el precio.")
      .max(10_000_000, "Revisá el precio."),
    unitsPerDisplay: z.number().int().min(1, "Barritas por display: al menos 1.").max(500),
    active: z.boolean(),
    soldOut: z.boolean(),
    highlighted: z.boolean().default(false),
    kind: z.enum(["FIXED", "CUSTOM"]),
    boxDisplays: z
      .number({ invalid_type_error: "Displays por caja: tiene que ser un número." })
      .int("Displays por caja: sin decimales.")
      .min(1, "La caja tiene que llevar al menos 1 display.")
      .max(WHOLESALE_MAX_BOX_DISPLAYS, `La caja puede llevar hasta ${WHOLESALE_MAX_BOX_DISPLAYS} displays.`),
    // FIXED: cuántos displays de cada producto trae. CUSTOM: los sabores que se pueden elegir (la cantidad no se usa).
    components: z
      .array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(0).max(WHOLESALE_MAX_BOX_DISPLAYS) }))
      .max(30),
  })
  .transform((data) => {
    // Sin repetidos y, en composición fija, solo los que llevan al menos 1 display.
    const seen = new Set<string>();
    const components = data.components.filter((component) => {
      if (seen.has(component.productId)) return false;
      seen.add(component.productId);
      return data.kind === "CUSTOM" || component.quantity > 0;
    });
    return { ...data, components: components.map((component) => ({ ...component, quantity: data.kind === "CUSTOM" ? 0 : component.quantity })) };
  })
  // Sin composición el pedido no sabría qué displays mandar a la planilla y a la app de operaciones.
  .refine((data) => !data.active || data.components.length > 0, {
    message: "Para mostrarlo en /mayoristas, elegí qué displays lleva (o qué sabores se pueden elegir).",
    path: ["components"],
  })
  .refine((data) => data.kind !== "FIXED" || data.components.reduce((sum, component) => sum + component.quantity, 0) <= WHOLESALE_MAX_BOX_DISPLAYS, {
    message: `Un bulto puede llevar hasta ${WHOLESALE_MAX_BOX_DISPLAYS} displays.`,
    path: ["components"],
  });

export const wholesaleProductCreateSchema = z.object({ kind: z.enum(["FIXED", "CUSTOM"]).default("FIXED") }).catch({ kind: "FIXED" });

export const wholesaleProductOrderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

export type WholesaleProductInput = z.infer<typeof wholesaleProductSchema>;
