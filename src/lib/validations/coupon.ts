import { z } from "zod";

export const couponCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, "El cupon solo puede incluir letras, numeros, guiones y guion bajo.");

const couponBulkEntrySchema = z.object({
  code: couponCodeSchema,
  discountPercentage: z.coerce.number().min(0.01).max(100).optional(),
  fixedDiscountArs: z.coerce.number().int().min(1).optional(),
});

export const couponFormSchema = z
  .object({
    code: couponCodeSchema.optional().or(z.literal("")),
    codes: z.array(couponCodeSchema).max(200).optional(),
    entries: z.array(couponBulkEntrySchema).max(200).optional(),
    description: z.string().max(160).optional().or(z.literal("")),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]).default("PERCENTAGE"),
    discountPercentage: z.coerce.number().min(0.01).max(100).optional(),
    fixedDiscountArs: z.coerce.number().int().min(1).optional(),
    usageType: z.enum(["UNLIMITED", "SINGLE_USE", "SINGLE_USE_PER_CUSTOMER"]).default("UNLIMITED"),
    active: z.coerce.boolean(),
  })
  .superRefine((data, ctx) => {
    const hasBulkEntries = Boolean(data.entries?.length);

    if (data.discountType === "PERCENTAGE") {
      if (!hasBulkEntries && (!data.discountPercentage || data.discountPercentage <= 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["discountPercentage"],
          message: "Ingresa un porcentaje valido.",
        });
      }
    } else if (!hasBulkEntries && (!data.fixedDiscountArs || data.fixedDiscountArs <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fixedDiscountArs"],
        message: "Ingresa un monto fijo valido.",
      });
    }

    if (!hasBulkEntries) {
      return;
    }

    const entries = data.entries ?? [];

    for (const [index, entry] of entries.entries()) {
      if (data.discountType === "PERCENTAGE") {
        if (!entry.discountPercentage || entry.discountPercentage <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["entries", index, "discountPercentage"],
            message: "Cada fila masiva necesita un porcentaje valido.",
          });
        }

        continue;
      }

      if (!entry.fixedDiscountArs || entry.fixedDiscountArs <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entries", index, "fixedDiscountArs"],
          message: "Cada fila masiva necesita un monto fijo valido.",
        });
      }
    }
  });

export const couponPreviewSchema = z.object({
  code: couponCodeSchema,
  subtotalArs: z.coerce.number().int().min(1),
  taxId: z.string().trim().max(20).optional().or(z.literal("")),
});

export type CouponFormInput = z.infer<typeof couponFormSchema>;
