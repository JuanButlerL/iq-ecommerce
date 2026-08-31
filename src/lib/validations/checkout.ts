import { z } from "zod";

import { ARGENTINA_PROVINCES } from "@/lib/constants/provinces";
import { marketingSessionContextSchema } from "@/lib/marketing/attribution";

const nameRegex = /^[\p{L}' -]+$/u;
const localityRegex = /^[\p{L}0-9'.,()\/ -]+$/u;
const addressRegex = /^[\p{L}0-9'.,()/#° -]+$/u;
const taxIdRegex = /^\d{7,11}$/;

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

const provinceNames = new Set(ARGENTINA_PROVINCES.map((province) => province.name));

export const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99),
});

export const checkoutSchema = z.object({
  checkoutRequestKey: z.string().uuid(),
  firstName: z
    .string()
    .transform(normalizeWhitespace)
    .pipe(
      z
        .string()
        .min(2, "Escribí tu nombre completo o al menos 2 letras.")
        .max(80, "El nombre es demasiado largo.")
        .regex(nameRegex, "El nombre solo puede incluir letras, espacios, apóstrofes o guiones."),
    ),
  lastName: z
    .string()
    .transform(normalizeWhitespace)
    .pipe(
      z
        .string()
        .min(2, "Escribí tu apellido completo o al menos 2 letras.")
        .max(80, "El apellido es demasiado largo.")
        .regex(nameRegex, "El apellido solo puede incluir letras, espacios, apóstrofes o guiones."),
    ),
  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.string().email("Revisá el email. Tiene que tener formato nombre@dominio.com.")),
  phone: z
    .string()
    .transform((value) => value.trim())
    .superRefine((value, ctx) => {
      const digits = value.replace(/\D/g, "");

      if (digits.length < 8 || digits.length > 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ingresá un teléfono válido con entre 8 y 15 números.",
        });
      }
    }),
  province: z
    .string()
    .transform(normalizeWhitespace)
    .refine((value) => provinceNames.has(value), "Seleccioná una provincia válida del listado."),
  locality: z
    .string()
    .transform(normalizeWhitespace)
    .pipe(
      z
        .string()
        .min(2, "Ingresá la localidad tal como figura para el envío.")
        .max(120, "La localidad es demasiado larga.")
        .regex(localityRegex, "La localidad tiene caracteres no válidos."),
    ),
  postalCode: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => /^\d{4,8}$/.test(value), "El código postal debe ser numérico y tener entre 4 y 8 dígitos."),
  addressLine: z
    .string()
    .transform(normalizeWhitespace)
    .superRefine((value, ctx) => {
      if (value.length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_small,
          minimum: 6,
          inclusive: true,
          type: "string",
          message: "Escribí la calle y la altura. Ejemplo: Av. Santa Fe 1234.",
        });
      }

      if (value.length > 160) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: 160,
          inclusive: true,
          type: "string",
          message: "La dirección es demasiado larga.",
        });
      }

      if (!addressRegex.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La dirección tiene caracteres no válidos.",
        });
      }

      if (!/\p{L}/u.test(value) || !/\d/.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La dirección debe incluir calle y número. Ejemplo: Amenábar 2451.",
        });
      }
    }),
  addressExtra: z
    .string()
    .transform(normalizeWhitespace)
    .pipe(z.string().max(120, "Piso, depto. o referencia demasiado larga."))
    .optional()
    .or(z.literal("")),
  taxId: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => taxIdRegex.test(value), "Ingresá un DNI o CUIT válido, solo con números."),
  couponCode: z.string().max(40).optional().or(z.literal("")),
  paymentMethod: z.enum(["BANK_TRANSFER", "MERCADO_PAGO"]).default("BANK_TRANSFER"),
  notes: z
    .string()
    .transform(normalizeWhitespace)
    .pipe(z.string().max(500, "Las observaciones no pueden superar los 500 caracteres."))
    .optional()
    .or(z.literal("")),
  marketing: marketingSessionContextSchema.optional(),
  items: z.array(checkoutItemSchema).min(1),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export const checkoutCustomerSchema = checkoutSchema.omit({ items: true });
export type CheckoutCustomerInput = z.infer<typeof checkoutCustomerSchema>;