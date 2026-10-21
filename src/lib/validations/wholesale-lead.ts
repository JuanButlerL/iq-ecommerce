import { z } from "zod";

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
    .optional()
    .transform((value) => value || null);

export const wholesaleLeadSchema = z.object({
  nombre: required("tu nombre", 120),
  telefono: required("tu teléfono", 40).refine((value) => value.replace(/\D/g, "").length >= 8, {
    message: "Revisá el teléfono: tiene que tener al menos 8 números.",
  }),
  email: required("tu email", 160).pipe(z.string().toLowerCase().email("Revisá el email.")),
  negocio: optional("Nombre del negocio", 160),
  tipo: required("el tipo de negocio", 80),
  cuit: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.replace(/\D/g, "") : null))
    .refine((value) => value === null || value.length === 11, { message: "El CUIT debe tener exactamente 11 dígitos." }),
  calle: required("la calle y número", 160),
  piso: optional("Piso / Depto / Local", 80),
  ciudad: required("la ciudad", 120),
  provincia: required("la provincia", 80),
  cp: required("el código postal", 12),
  zona: optional("Referencia", 200),
  cantidad: optional("Cantidad estimada", 80),
  mensaje: optional("Mensaje", 2000),
  consentimiento: z.literal(true, { errorMap: () => ({ message: "Tenés que aceptar la política de privacidad." }) }),
  // Campo trampa: invisible para personas; si viene completo es un bot.
  website: z.string().optional(),
});

export type WholesaleLeadInput = z.infer<typeof wholesaleLeadSchema>;

export const WHOLESALE_LEAD_STATUSES = ["NEW", "CONTACTED", "CLIENT", "DISCARDED"] as const;

export const wholesaleLeadUpdateSchema = z.object({
  status: z.enum(WHOLESALE_LEAD_STATUSES, { errorMap: () => ({ message: "Estado inválido." }) }).optional(),
  adminNotes: z.string().trim().max(2000, "Notas: máximo 2000 caracteres.").optional(),
});
