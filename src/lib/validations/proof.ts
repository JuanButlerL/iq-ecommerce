import { z } from "zod";

export const allowedProofMimeTypes = ["image/jpeg", "image/png", "application/pdf"] as const;

export const paymentProofSchema = z.object({
  orderNumber: z.string().min(4),
  fileName: z.string().min(3),
  fileSize: z.number().max(8 * 1024 * 1024),
  mimeType: z.enum(allowedProofMimeTypes),
});
