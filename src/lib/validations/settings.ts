import { ShippingMode } from "@prisma/client";
import { z } from "zod";

export const storeSettingsSchema = z.object({
  storeName: z.string().min(2).max(120),
  whatsappNumber: z.string().min(10).max(30),
  instagramUrl: z.string().url().optional().or(z.literal("")),
  contactEmail: z.string().email(),
  bankAlias: z.string().min(3).max(80),
  bankCbu: z.string().min(10).max(40),
  bankName: z.string().min(2).max(120),
  bankHolder: z.string().min(2).max(120),
  bankTaxId: z.string().min(5).max(20),
  minimumOrderAmount: z.coerce.number().int().min(0),
  freeShippingThreshold: z.coerce.number().int().min(0),
  flatShippingPrice: z.coerce.number().int().min(0),
  shippingMode: z.nativeEnum(ShippingMode),
  activeShippingRuleId: z.string().uuid().optional().or(z.literal("")),
  checkoutMessage: z.string().max(500).optional().or(z.literal("")),
  transferInstructions: z.string().max(1200).optional().or(z.literal("")),
  mercadoPagoCheckoutLabel: z.string().max(160).optional().or(z.literal("")),
  orderReservationHours: z.coerce.number().int().min(1).max(168).optional(),
  institutionalBanner: z.string().max(160).optional().or(z.literal("")),
  purchaseSuccessMessage: z.string().max(500).optional().or(z.literal("")),
  requireTaxId: z.boolean().default(false),
  showFloatingWhatsapp: z.boolean().default(true),
  isStoreOpen: z.boolean().default(true),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;
