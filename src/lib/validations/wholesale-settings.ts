import { z } from "zod";

export const wholesaleSettingsSchema = z
  .object({
    minDisplays: z.number().int().min(1, "El mínimo tiene que ser de al menos 1 display.").max(1000),
    enableMercadoPago: z.boolean(),
    enableBankTransfer: z.boolean(),
    enableEcheq: z.boolean(),
    echeqMaxDays: z.number().int().min(0, "Revisá el plazo del eCheq.").max(180, "El plazo del eCheq puede ser como máximo 180 días."),
    echeqInstructions: z
      .string()
      .trim()
      .max(500, "Comentario del eCheq: máximo 500 caracteres.")
      .transform((value) => value || null),
    enableBankTransferDiscount: z.boolean(),
    bankTransferDiscountPercentage: z
      .number({ invalid_type_error: "El descuento debe ser un número." })
      .min(0, "El descuento no puede ser negativo.")
      .max(50, "El descuento por transferencia puede ser como máximo 50%."),
    freeShippingThresholdArs: z.number().int().min(1, "El monto de envío gratis tiene que ser mayor a 0.").nullable(),
    orderNotificationEmails: z
      .array(z.string().trim().toLowerCase().email("Revisá los emails de aviso."))
      .max(5, "Podés cargar hasta 5 emails de aviso."),
  })
  .refine((data) => data.enableMercadoPago || data.enableBankTransfer || data.enableEcheq, {
    message: "Dejá habilitado al menos un medio de pago.",
  });

export type WholesaleSettingsInput = z.infer<typeof wholesaleSettingsSchema>;
