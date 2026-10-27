import { z } from "zod";

export const freeShippingLinkSchema = z.object({
  emails: z
    .array(z.string().trim().email("Hay un email inválido."))
    .min(1, "Cargá al menos un email.")
    .max(100, "Máximo 100 emails por vez."),
  hours: z.coerce
    .number()
    .int()
    .min(1, "El vencimiento mínimo es 1 hora.")
    .max(24 * 30, "El vencimiento máximo es 30 días."),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});
