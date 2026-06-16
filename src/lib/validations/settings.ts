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
  enableBankTransfer: z.boolean().default(true),
  enableMercadoPago: z.boolean().default(true),
  enableBankTransferDiscount: z.boolean().default(false),
  bankTransferDiscountPercentage: z.coerce.number().min(0).max(100).default(0),
  orderReservationHours: z.coerce.number().int().min(1).max(168).optional(),
  institutionalBanner: z.string().max(160).optional().or(z.literal("")),
  announcementBarEnabled: z.boolean().default(false),
  announcementBarText: z.string().max(240).optional().or(z.literal("")),
  subscriptionSectionEnabled: z.boolean().default(true),
  subscriptionCtaUrl: z.string().url().optional().or(z.literal("")),
  subscriptionItemOne: z.string().max(120).optional().or(z.literal("")),
  subscriptionItemTwo: z.string().max(120).optional().or(z.literal("")),
  subscriptionItemThree: z.string().max(120).optional().or(z.literal("")),
  purchaseSuccessMessage: z.string().max(500).optional().or(z.literal("")),
  requireTaxId: z.boolean().default(false),
  showFloatingWhatsapp: z.boolean().default(true),
  isStoreOpen: z.boolean().default(true),
}).superRefine((data, ctx) => {
  if (!data.enableBankTransfer && !data.enableMercadoPago) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Activa al menos un medio de pago.",
      path: ["enableBankTransfer"],
    });
  }

  if (data.enableBankTransferDiscount && !data.enableBankTransfer) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Activa transferencia para usar este descuento.",
      path: ["enableBankTransferDiscount"],
    });
  }

  if (data.enableBankTransferDiscount && data.bankTransferDiscountPercentage <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Ingresa un porcentaje mayor a 0.",
      path: ["bankTransferDiscountPercentage"],
    });
  }

  if (data.announcementBarEnabled && !data.announcementBarText?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Ingresa el texto del ticker superior.",
      path: ["announcementBarText"],
    });
  }

  if (data.subscriptionSectionEnabled && !data.subscriptionItemOne?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Completa la primera caja de la sección de suscripción.",
      path: ["subscriptionItemOne"],
    });
  }

  if (data.subscriptionSectionEnabled && !data.subscriptionItemTwo?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Completa la segunda caja de la sección de suscripción.",
      path: ["subscriptionItemTwo"],
    });
  }

  if (data.subscriptionSectionEnabled && !data.subscriptionItemThree?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Completa la tercera caja de la sección de suscripción.",
      path: ["subscriptionItemThree"],
    });
  }
});

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;
