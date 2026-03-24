import { z } from "zod";

export const allowedProofMimeTypes = ["image/jpeg", "image/png", "application/pdf"] as const;

const dniSchema = z
  .string()
  .trim()
  .regex(/^\d{7,8}$/, "Ingresa un DNI valido de 7 u 8 numeros.");

export const paymentProofSchema = z.object({
  orderNumber: z.string().min(4),
  fileName: z.string().min(3),
  fileSize: z.number().max(8 * 1024 * 1024),
  mimeType: z.enum(allowedProofMimeTypes),
  transferSenderName: dniSchema,
  transferDate: z.string().max(40).optional().or(z.literal("")),
  transferReference: z.string().trim().max(80).optional().or(z.literal("")),
  customerNote: z.string().trim().max(240).optional().or(z.literal("")),
});

export const paymentProofFormSchema = z.object({
  transferSenderName: dniSchema,
  transferDate: z.string().optional(),
  transferReference: z.string().trim().max(80).optional(),
  customerNote: z.string().trim().max(240).optional(),
});

export type PaymentProofFormInput = z.infer<typeof paymentProofFormSchema>;
