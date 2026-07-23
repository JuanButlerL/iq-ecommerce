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
});
