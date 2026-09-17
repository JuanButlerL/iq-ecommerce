import { EmailAutomationTrigger } from "@prisma/client";
import { z } from "zod";

export const emailAutomationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  trigger: z.nativeEnum(EmailAutomationTrigger),
  active: z.boolean().default(false),
  delayHours: z.coerce.number().int().min(0).max(24 * 365),
  subject: z.string().trim().min(3).max(180),
  previewText: z.string().trim().max(220).optional().or(z.literal("")),
  bodyText: z.string().trim().min(3).max(5000),
  ctaLabel: z.string().trim().max(80).optional().or(z.literal("")),
  ctaUrlTemplate: z.string().trim().max(500).optional().or(z.literal("")),
  senderName: z.string().trim().min(2).max(80).default("IQ Kids"),
  fromEmail: z.string().trim().email().default("no-reply@iqkids.com.ar"),
  replyToEmail: z.string().trim().email().optional().or(z.literal("")),
  bccEmail: z.string().trim().email().optional().or(z.literal("")),
  couponId: z.string().uuid().optional().or(z.literal("")),
  couponHeadline: z.string().trim().max(120).optional().or(z.literal("")),
  couponMessage: z.string().trim().max(600).optional().or(z.literal("")),
  cartRecoveryFreeShippingEnabled: z.boolean().default(false),
  cartRecoveryFreeShippingMessage: z.string().trim().max(600).optional().or(z.literal("")),
}).superRefine((value, context) => {
  if (!value.cartRecoveryFreeShippingEnabled) return;

  if (value.trigger !== EmailAutomationTrigger.CART_ABANDONED) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["cartRecoveryFreeShippingEnabled"], message: "El envío bonificado sólo aplica a recuperación de carrito." });
  }

  if (value.ctaUrlTemplate !== "{{recoveryUrl}}") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["ctaUrlTemplate"], message: "El envío bonificado requiere usar {{recoveryUrl}} como CTA." });
  }

  if (!value.cartRecoveryFreeShippingMessage) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["cartRecoveryFreeShippingMessage"], message: "Escribí el mensaje del envío bonificado." });
  }
});
