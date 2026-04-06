import { z } from "zod";

export const couponCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, "El cupón solo puede incluir letras, números, guiones y guión bajo.");

export const couponFormSchema = z.object({
  code: couponCodeSchema,
  description: z.string().max(160).optional().or(z.literal("")),
  discountPercentage: z.coerce.number().min(0.01).max(100),
  active: z.coerce.boolean(),
});

export const couponPreviewSchema = z.object({
  code: couponCodeSchema,
  subtotalArs: z.coerce.number().int().min(1),
});

export type CouponFormInput = z.infer<typeof couponFormSchema>;
