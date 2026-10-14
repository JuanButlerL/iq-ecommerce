import { z } from "zod";

const dateParam = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), { message: "Fecha inválida." });

export const productDiscountFormSchema = z
  .object({
    discountPercentage: z
      .number({ invalid_type_error: "El descuento debe ser un número." })
      .int("El descuento debe ser un número entero.")
      .min(1, "El descuento tiene que ser de al menos 1%.")
      .max(90, "El descuento puede ser como máximo 90%.")
      .nullable(),
    startsOn: dateParam.default(""),
    endsOn: dateParam.default(""),
  })
  .refine((data) => !data.startsOn || !data.endsOn || data.endsOn >= data.startsOn, {
    message: "La fecha de fin no puede ser anterior a la de inicio.",
    path: ["endsOn"],
  });

export type ProductDiscountFormInput = z.infer<typeof productDiscountFormSchema>;
