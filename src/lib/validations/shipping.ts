import { ShippingMode } from "@prisma/client";
import { z } from "zod";

export const shippingRuleSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(240).optional().or(z.literal("")),
  mode: z.nativeEnum(ShippingMode),
  flatPrice: z.coerce.number().int().min(0).optional(),
  active: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export const shippingProvinceSchema = z.object({
  provinceCode: z.string().min(1).max(5),
  provinceName: z.string().min(2).max(120),
  shippingPrice: z.coerce.number().int().min(0),
  active: z.boolean().default(true),
});
