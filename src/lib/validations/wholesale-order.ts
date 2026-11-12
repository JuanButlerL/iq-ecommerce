import { z } from "zod";

import { WHOLESALE_PAYMENT_METHODS } from "@/features/wholesale/pricing";
import { marketingSessionContextSchema } from "@/lib/marketing/attribution";
import { isValidCuit, normalizeCuit } from "@/lib/utils/cuit";
import { TAX_CONDITIONS } from "@/lib/validations/wholesale-customer";

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

export const wholesaleEmailSchema = required("tu email", 160).pipe(z.string().toLowerCase().email("Revisá el email."));

export const wholesaleCuitSchema = required("el CUIT", 20)
  .transform(normalizeCuit)
  .refine(isValidCuit, { message: "El CUIT no es válido: revisá los 11 números." });

export const wholesaleIdentifySchema = z.object({
  email: wholesaleEmailSchema,
  cuit: z.string().trim().max(20).optional(),
  remember: z.boolean().default(false),
});

export const wholesaleDeliverySchema = z.object({
  contactName: required("el nombre de quien recibe", 120),
  phone: required("el teléfono", 40).refine((value) => value.replace(/\D/g, "").length >= 8, {
    message: "Revisá el teléfono: tiene que tener al menos 8 números.",
  }),
  street: required("la calle y número", 160),
  floor: optional("Piso / Depto / Local", 80),
  city: required("la ciudad", 120),
  province: required("la provincia", 80),
  postalCode: required("el código postal", 12),
  reference: optional("Referencia", 200),
});

export const wholesaleOrderSchema = z.object({
  checkoutRequestKey: z.string().trim().min(8).max(100),
  remember: z.boolean().default(false),
  items: z
    .array(z.object({ wholesaleProductId: z.string().uuid(), quantity: z.number().int().min(1).max(1000) }))
    .min(1, "Tu pedido está vacío.")
    .max(50),
  customer: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("existing"), customerId: z.string().uuid() }),
    z.object({
      mode: z.literal("new"),
      email: wholesaleEmailSchema,
      cuit: wholesaleCuitSchema,
      legalName: optional("Razón social", 160),
      businessName: optional("Nombre del negocio", 160),
      businessType: optional("Tipo de negocio", 80),
    }),
  ]),
  taxCondition: z.enum(TAX_CONDITIONS, { errorMap: () => ({ message: "Elegí tu condición frente al IVA." }) }),
  delivery: wholesaleDeliverySchema,
  paymentMethod: z.enum(WHOLESALE_PAYMENT_METHODS, { errorMap: () => ({ message: "Elegí cómo vas a pagar." }) }),
  notes: optional("Comentarios", 1000),
  // Origen de la visita (UTM, referrer). Si llega mal formado se ignora: nunca frena el pedido.
  marketing: marketingSessionContextSchema.optional().catch(undefined),
});

export type WholesaleOrderInput = z.infer<typeof wholesaleOrderSchema>;
