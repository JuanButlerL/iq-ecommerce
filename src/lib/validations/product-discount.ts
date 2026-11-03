import { z } from "zod";

import { BUY_X_PAY_Y_MAX_BUY_QUANTITY, isValidBuyXPayY } from "@/features/catalog/lib/product-discount";

const dateParam = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), { message: "Fecha inválida." });

export const productDiscountFormSchema = z
  .object({
    // Older admin clients only send the percentage, so the type defaults to it.
    discountType: z.enum(["PERCENTAGE", "BUY_X_PAY_Y"]).default("PERCENTAGE"),
    discountPercentage: z
      .number({ invalid_type_error: "El descuento debe ser un número." })
      .int("El descuento debe ser un número entero.")
      .min(1, "El descuento tiene que ser de al menos 1%.")
      .max(90, "El descuento puede ser como máximo 90%.")
      .nullable()
      .default(null),
    // Buy X pay Y (e.g. 3x2): buyQuantity = 3, payQuantity = 2. Null removes the promo.
    buyQuantity: z.number({ invalid_type_error: "Llevás debe ser un número." }).int().nullable().default(null),
    payQuantity: z.number({ invalid_type_error: "Pagás debe ser un número." }).int().nullable().default(null),
    freeUnitsCountForFreeShipping: z.boolean().default(true),
    startsOn: dateParam.default(""),
    endsOn: dateParam.default(""),
  })
  .refine((data) => !data.startsOn || !data.endsOn || data.endsOn >= data.startsOn, {
    message: "La fecha de fin no puede ser anterior a la de inicio.",
    path: ["endsOn"],
  })
  .refine(
    (data) =>
      data.discountType !== "BUY_X_PAY_Y" ||
      (data.buyQuantity == null && data.payQuantity == null) ||
      isValidBuyXPayY(data.buyQuantity, data.payQuantity),
    {
      message: `El NxM no es válido: llevás entre 2 y ${BUY_X_PAY_Y_MAX_BUY_QUANTITY} unidades y pagás menos de las que llevás (ej: 3x2).`,
      path: ["buyQuantity"],
    },
  );

export type ProductDiscountFormInput = z.infer<typeof productDiscountFormSchema>;
