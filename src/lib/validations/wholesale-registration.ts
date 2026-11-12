import { z } from "zod";

import { marketingSessionContextSchema } from "@/lib/marketing/attribution";
import { TAX_CONDITIONS } from "@/lib/validations/wholesale-customer";
import { wholesaleCuitSchema, wholesaleEmailSchema } from "@/lib/validations/wholesale-order";

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

// Registro de un cliente mayorista desde /mayoristas/registro: crea la ficha en el maestro con los datos de entrega.
export const wholesaleRegistrationSchema = z.object({
  contactName: required("tu nombre", 120),
  phone: required("tu teléfono", 40).refine((value) => value.replace(/\D/g, "").length >= 8, {
    message: "Revisá el teléfono: tiene que tener al menos 8 números.",
  }),
  email: wholesaleEmailSchema,
  businessName: optional("Nombre del negocio", 160),
  legalName: optional("Razón social", 160),
  businessType: required("el tipo de negocio", 80),
  cuit: wholesaleCuitSchema,
  taxCondition: z.enum(TAX_CONDITIONS, { errorMap: () => ({ message: "Elegí tu condición frente al IVA." }) }),
  street: required("la calle y número", 160),
  floor: optional("Piso / Depto / Local", 80),
  city: required("la ciudad", 120),
  province: required("la provincia", 80),
  postalCode: required("el código postal", 12),
  reference: optional("Referencia", 200),
  monthlyVolume: optional("Cantidad estimada", 80),
  message: optional("Mensaje", 2000),
  consent: z.literal(true, { errorMap: () => ({ message: "Tenés que aceptar la política de privacidad." }) }),
  // Campo trampa: invisible para personas; si viene completo es un bot.
  website: z.string().optional(),
  // Origen de la visita (UTM, referrer). Si llega mal formado se ignora: nunca frena el registro.
  marketing: marketingSessionContextSchema.optional().catch(undefined),
});

export type WholesaleRegistrationInput = z.infer<typeof wholesaleRegistrationSchema>;
