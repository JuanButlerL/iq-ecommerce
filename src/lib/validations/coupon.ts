import { z } from "zod";

import { BUY_X_PAY_Y_MAX_BUY_QUANTITY, isValidBuyXPayY } from "@/features/catalog/lib/product-discount";

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
    welcomePopupEnabled: z.coerce.boolean().default(false),
    discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "BUY_X_PAY_Y"]).default("PERCENTAGE"),
    discountPercentage: z.coerce.number().min(0.01).max(100).optional(),
    fixedDiscountArs: z.coerce.number().int().min(1).optional(),
    // Buy X pay Y (e.g. 3x2): buyQuantity = 3, payQuantity = 2.
    buyQuantity: z.coerce.number().int().min(2).max(BUY_X_PAY_Y_MAX_BUY_QUANTITY).optional(),
    payQuantity: z.coerce.number().int().min(1).max(BUY_X_PAY_Y_MAX_BUY_QUANTITY - 1).optional(),
    freeUnitsCountForFreeShipping: z.boolean().default(true),
    // false: units of different products can be combined; true: each product counts on its own.
    buyXPayYSameProductOnly: z.boolean().default(false),
    usageType: z.enum(["UNLIMITED", "SINGLE_USE", "SINGLE_USE_PER_CUSTOMER"]).default("UNLIMITED"),
    active: z.coerce.boolean(),
  })
  .superRefine((data, ctx) => {
    const hasBulkEntries = Boolean(data.entries?.length);

    if (data.discountType === "BUY_X_PAY_Y") {
      if (!isValidBuyXPayY(data.buyQuantity, data.payQuantity)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["buyQuantity"],
          message: `Configurá un NxM válido: llevás entre 2 y ${BUY_X_PAY_Y_MAX_BUY_QUANTITY} unidades y pagás menos de las que llevás (ej: 3x2).`,
        });
      }

      if (hasBulkEntries) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entries"],
          message: "Para cupones NxM la carga masiva es una lista de códigos, uno por línea.",
        });
      }

      return;
    }

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
  // Cart lines, so the server can price buy X pay Y coupons from the catalog (never from the client).
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(99),
      }),
    )
    .max(50)
    .optional(),
});

export type CouponFormInput = z.infer<typeof couponFormSchema>;
