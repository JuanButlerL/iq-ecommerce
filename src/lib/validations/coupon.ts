import { z } from "zod";

export const couponCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, "El cupón solo puede incluir letras, números, guiones y guión bajo.");

export const couponFormSchema = z.object({
  code: couponCodeSchema.optional().or(z.literal("")),
  codes: z.array(couponCodeSchema).max(200).optional(),
  description: z.string().max(160).optional().or(z.literal("")),
  discountPercentage: z.coerce.number().min(0.01).max(100),
  usageType: z.enum(["UNLIMITED", "SINGLE_USE", "SINGLE_USE_PER_CUSTOMER"]).default("UNLIMITED"),
  active: z.coerce.boolean(),
});

export const couponPreviewSchema = z.object({
  code: couponCodeSchema,
  subtotalArs: z.coerce.number().int().min(1),
  taxId: z.string().trim().max(20).optional().or(z.literal("")),
});

export type CouponFormInput = z.infer<typeof couponFormSchema>;
