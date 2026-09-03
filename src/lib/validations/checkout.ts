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

const checkoutBaseSchema = z.object({
  checkoutRequestKey: z.string().uuid(),
  firstName: z
    .string()
    .transform(normalizeWhitespace)
    .pipe(
      z
        .string()
        .min(2, "Ingresá al menos 2 letras.")
        .max(80, "El nombre es demasiado largo.")
        .regex(nameRegex, "Usá solo letras, espacios o guiones."),
    ),
  lastName: z
    .string()
    .transform(normalizeWhitespace)
    .pipe(
      z
        .string()
        .min(2, "Ingresá al menos 2 letras.")
        .max(80, "El apellido es demasiado largo.")
        .regex(nameRegex, "Usá solo letras, espacios o guiones."),
    ),
  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.string().email("Revisá el formato del email.")),
  phone: z
    .string()
    .transform((value) => value.trim())
    .superRefine((value, ctx) => {
      const digits = value.replace(/\D/g, "");

      if (digits.length < 8 || digits.length > 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ingresá entre 8 y 15 números.",
        });
      }
    }),
  province: z
    .string()
    .transform(normalizeWhitespace)
    .refine((value) => provinceNames.has(value), "Seleccioná una provincia válida."),
  locality: z
    .string()
    .transform(normalizeWhitespace)
    .pipe(
      z
        .string()
        .min(2, "Ingresá una localidad válida.")
        .max(120, "La localidad es demasiado larga.")
        .regex(localityRegex, "La localidad tiene caracteres inválidos."),
    ),
  postalCode: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => /^\d{4,8}$/.test(value), "Ingresá entre 4 y 8 números."),
  addressLine: z
    .string()
    .transform(normalizeWhitespace)
    .superRefine((value, ctx) => {
      if (value.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_small,
          minimum: 2,
          inclusive: true,
          type: "string",
          message: "Ingresá el nombre de la calle.",
        });
      }

      if (value.length > 160) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: 160,
          inclusive: true,
          type: "string",
          message: "La calle es demasiado larga.",
        });
      }

      if (!addressRegex.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La calle tiene caracteres inválidos.",
        });
      }

      if (!/\p{L}/u.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Ingresá una calle válida.",
        });
      }
    }),
  addressNumber: z
    .string()
    .transform(normalizeWhitespace)
    .superRefine((value, ctx) => {
      if (value && !/^\d{1,8}(?:\s*(?:bis|[a-z]))?$/i.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Usá números o 'bis'.",
        });
      }
    }),
  addressWithoutNumber: z.boolean().default(false),
  addressExtra: z
    .string()
    .transform(normalizeWhitespace)
    .pipe(z.string().max(120, "Máximo 120 caracteres."))
    .optional()
    .or(z.literal("")),
  taxId: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => taxIdRegex.test(value), "Ingresá entre 7 y 11 números."),
  couponCode: z.string().max(40).optional().or(z.literal("")),
  paymentMethod: z.enum(["BANK_TRANSFER", "MERCADO_PAGO"]).default("BANK_TRANSFER"),
  notes: z
    .string()
    .transform(normalizeWhitespace)
    .pipe(z.string().max(500, "Máximo 500 caracteres."))
    .optional()
    .or(z.literal("")),
  marketing: marketingSessionContextSchema.optional(),
  items: z.array(checkoutItemSchema).min(1),
});

function validateCheckoutAddress(
  value: Pick<z.infer<typeof checkoutBaseSchema>, "addressLine" | "addressNumber" | "addressWithoutNumber">,
  ctx: z.RefinementCtx,
) {
  if (!value.addressWithoutNumber && !value.addressNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["addressNumber"],
      message: "Ingresá la altura o marcá la opción.",
    });
  }

  if (/\d+\s*(?:bis|[a-z])?$/i.test(value.addressLine)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["addressLine"],
      message: "Ingresá solo el nombre de la calle.",
    });
  }
}

export const checkoutSchema = checkoutBaseSchema.superRefine(validateCheckoutAddress);

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export const checkoutCustomerSchema = checkoutBaseSchema.omit({ items: true }).superRefine(validateCheckoutAddress);
export type CheckoutCustomerInput = z.infer<typeof checkoutCustomerSchema>;
