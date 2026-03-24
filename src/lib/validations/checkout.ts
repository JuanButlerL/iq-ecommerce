import { z } from "zod";

export const checkoutItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99),
});

export const checkoutSchema = z.object({
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  email: z.string().email(),
  phone: z.string().min(8).max(30),
  province: z.string().min(2).max(80),
  locality: z.string().min(2).max(120),
  postalCode: z.string().min(3).max(12),
  addressLine: z.string().min(4).max(160),
  addressExtra: z.string().max(120).optional().or(z.literal("")),
  taxId: z.string().max(20).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  items: z.array(checkoutItemSchema).min(1),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export const checkoutCustomerSchema = checkoutSchema.omit({ items: true });
export type CheckoutCustomerInput = z.infer<typeof checkoutCustomerSchema>;
