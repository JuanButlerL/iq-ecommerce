import { z } from "zod";

import { isValidCuit, normalizeCuit } from "@/lib/utils/cuit";

export const TAX_CONDITIONS = ["RESPONSABLE_INSCRIPTO", "MONOTRIBUTO", "EXENTO", "CONSUMIDOR_FINAL"] as const;

const required = (field: string, max: number) =>
  z
    .string({ required_error: `Completá ${field}.`, invalid_type_error: `Completá ${field}.` })
    .trim()
    .min(1, `Completá ${field}.`)
    .max(max, `${field}: máximo ${max} caracteres.`);

const optional = (field: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${field}: máximo ${max} caracteres.`)
    .nullish()
    .transform((value) => value || null);

export const wholesaleCustomerSchema = z.object({
  email: required("el email", 160).pipe(z.string().toLowerCase().email("Revisá el email.")),
  phone: required("el teléfono", 40).refine((value) => value.replace(/\D/g, "").length >= 8, {
    message: "Revisá el teléfono: tiene que tener al menos 8 números.",
  }),
  contactName: required("el nombre de contacto", 120),
  businessName: optional("Nombre del negocio", 160),
  legalName: optional("Razón social", 160),
  businessType: optional("Tipo de negocio", 80),
  cuit: required("el CUIT", 20)
    .transform(normalizeCuit)
    .refine(isValidCuit, { message: "El CUIT no es válido: revisá los 11 números." }),
  taxCondition: z.enum(TAX_CONDITIONS, { errorMap: () => ({ message: "Elegí la condición frente al IVA." }) }).nullable(),
  street: required("la calle y número", 160),
  floor: optional("Piso / Depto / Local", 80),
  city: required("la ciudad", 120),
  province: required("la provincia", 80),
  postalCode: required("el código postal", 12),
  reference: optional("Referencia", 200),
  allowDeferredPayment: z.boolean(),
  extraDiscountPercentage: z
    .number({ invalid_type_error: "El descuento debe ser un número." })
    .min(0, "El descuento no puede ser negativo.")
    .max(50, "El descuento extra puede ser como máximo 50%.")
    .transform((value) => Math.round(value * 100) / 100),
  active: z.boolean(),
  adminNotes: optional("Notas", 2000),
  leadId: z.string().uuid().nullish(),
});

export type WholesaleCustomerInput = z.infer<typeof wholesaleCustomerSchema>;
