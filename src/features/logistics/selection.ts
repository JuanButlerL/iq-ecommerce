import { z } from "zod";

// Lo que manda el checkout. El servidor recalcula todo: el precio nunca viene del navegador.
// Sin dependencias del servidor: lo usa también el formulario del checkout.
export const shippingSelectionSchema = z.object({
  carrier: z.enum(["OWN", "ANDREANI", "CORREO_AR"]),
  deliveryType: z.enum(["HOME", "BRANCH"]),
  branchId: z.string().trim().max(40).optional().or(z.literal("")),
});

export type ShippingSelection = z.infer<typeof shippingSelectionSchema>;
