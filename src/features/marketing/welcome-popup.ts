import { randomUUID } from "crypto";
import { EmailAutomationTrigger, EmailSendStatus, MarketingEventType, OrderStatus, PaymentStatus, Prisma, type CouponDiscountType } from "@prisma/client";
import { z } from "zod";

import { getCouponDiscountLabel } from "@/features/coupons/lib/coupon-pricing";
import { isWelcomePopupCoupon, stripWelcomePopupCouponMarker } from "@/features/coupons/lib/welcome-popup-coupon";
import { sendEmail } from "@/features/email/provider";
import { renderMarketingEmail } from "@/features/email/render";
import {
  WELCOME_POPUP_IMMEDIATE_AUTOMATION_ID,
  WELCOME_POPUP_IMMEDIATE_AUTOMATION_NAME,
} from "@/features/email/system-automations";
import { ensureMarketingSession, logMarketingEvent } from "@/features/marketing/attribution-service";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { marketingSessionContextSchema } from "@/lib/marketing/attribution";
import { welcomePopupCopy } from "@/lib/marketing/welcome-popup-copy";

const WELCOME_POPUP_LEAD_WINDOW_DAYS = 30;
const POPUP_CTA_URL = `${env.NEXT_PUBLIC_SITE_URL}/#productos`;

const welcomePopupSchema = z.object({
  email: z.string().trim().email().max(180),
  marketing: marketingSessionContextSchema.optional(),
});

const confirmedCouponPaymentStatuses = [PaymentStatus.PAID, PaymentStatus.PROOF_UPLOADED];
const cancelledCouponOrderStatuses = [OrderStatus.CANCELLED, OrderStatus.EXPIRED];

type WelcomePopupCoupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountPercentage: number | null;
  fixedDiscountArs: number | null;
  discountLabel: string;
};

function welcomeLeadWindowStart() {
  return new Date(Date.now() - WELCOME_POPUP_LEAD_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

function buildImmediateWelcomePopupTargetId(leadId: string) {
  return `welcome-popup-immediate:${leadId}`;
}

function toPopupCoupon(coupon: {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountPercentage: number | null;
  fixedDiscountArs: number | null;
}): WelcomePopupCoupon {
  return {
    id: coupon.id,
    code: coupon.code,
    description: stripWelcomePopupCouponMarker(coupon.description) || null,
    discountType: coupon.discountType,
    discountPercentage: coupon.discountPercentage,
    fixedDiscountArs: coupon.fixedDiscountArs,
    discountLabel: getCouponDiscountLabel({
      discountType: coupon.discountType,
      discountPercentage: coupon.discountPercentage,
      fixedDiscountArs: coupon.fixedDiscountArs,
    }),
  };
}

export async function getWelcomePopupConfig() {
  const coupon = await prisma.coupon.findFirst({
    where: {
      active: true,
      description: {
        contains: "[WELCOME_POPUP]",
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  if (!coupon || !isWelcomePopupCoupon(coupon.description)) {
    return { enabled: false as const };
  }

  return {
    enabled: true as const,
    coupon: toPopupCoupon({
      id: coupon.id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountPercentage: coupon.discountPercentage == null ? null : Number(coupon.discountPercentage),
      fixedDiscountArs: coupon.fixedDiscountArs ?? null,
    }),
  };
}

export async function captureWelcomePopupLead(payload: unknown, userAgent?: string | null) {
  const parsed = welcomePopupSchema.safeParse(payload);

  if (!parsed.success) {
    throw new AppError("Ingresá un email válido.", 400);
  }

  const config = await getWelcomePopupConfig();

  if (!config.enabled || !config.coupon) {
    throw new AppError("El beneficio de bienvenida no está disponible ahora.", 409);
  }

  const email = parsed.data.email.toLowerCase();
  const marketingSession = await ensureMarketingSession(parsed.data.marketing, email);
  const latestLead = await prisma.cartRecoveryLead.findFirst({
    where: {
      email,
      updatedAt: {
        gte: welcomeLeadWindowStart(),
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  let leadId = latestLead?.id ?? null;

  if (!latestLead) {
    const createdLead = await prisma.cartRecoveryLead.create({
      data: {
        email,
        recoveryToken: randomUUID(),
        items: [],
        subtotalArs: 0,
        status: "WELCOME_CAPTURED",
        userAgent: userAgent ?? null,
        marketingSessionId: marketingSession?.id ?? null,
        marketingVisitorId: marketingSession?.visitorId ?? null,
      },
      select: {
        id: true,
      },
    });

    leadId = createdLead.id;
  } else if (latestLead.status === "WELCOME_CAPTURED") {
    const updatedLead = await prisma.cartRecoveryLead.update({
      where: { id: latestLead.id },
      data: {
        userAgent: userAgent ?? latestLead.userAgent,
        marketingSessionId: marketingSession?.id ?? latestLead.marketingSessionId ?? null,
        marketingVisitorId: marketingSession?.visitorId ?? latestLead.marketingVisitorId ?? null,
      },
      select: {
        id: true,
      },
    });

    leadId = updatedLead.id;
  }

  if (!leadId) {
    throw new AppError("No pudimos registrar el email para seguimiento.", 500);
  }

  await logMarketingEvent({
    marketingContext: parsed.data.marketing,
    eventType: MarketingEventType.POPUP_CAPTURED,
    email,
    path: parsed.data.marketing?.pagePath ?? "/",
    cartRecoveryLeadId: leadId,
    metadata: {
      couponCode: config.coupon.code,
    },
  });

  const hasConfirmedOrder = await prisma.order.findFirst({
    where: {
      customerEmail: {
        equals: email,
        mode: "insensitive",
      },
      paymentStatus: {
        in: confirmedCouponPaymentStatuses,
      },
      orderStatus: {
        notIn: cancelledCouponOrderStatuses,
      },
    },
    select: {
      id: true,
    },
  });

  const emailSent = hasConfirmedOrder
    ? await logImmediateWelcomePopupSkipped({
        email,
        leadId,
        reason: "Omitido: el email ya tiene una compra confirmada.",
        coupon: config.coupon,
      })
    : await sendWelcomeCouponEmail({
        email,
        leadId,
        coupon: config.coupon,
      });

  return {
    leadId,
    emailSent,
    coupon: config.coupon,
  };
}

async function sendWelcomeCouponEmail(input: {
  email: string;
  leadId: string;
  coupon: WelcomePopupCoupon;
}) {
  const automationId = await ensureImmediateWelcomePopupAutomation(input.coupon);
  const existingLog = await prisma.emailSendLog.findFirst({
    where: {
      automationId,
      targetType: "cart_recovery_lead",
      OR: [
        { targetId: buildImmediateWelcomePopupTargetId(input.leadId) },
        { targetId: { startsWith: `${buildImmediateWelcomePopupTargetId(input.leadId)}:retry:` } },
      ],
      status: EmailSendStatus.SENT,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
    },
  });

  if (existingLog) {
    return true;
  }

  const latestAttempt = await prisma.emailSendLog.findFirst({
    where: {
      automationId,
      targetType: "cart_recovery_lead",
      OR: [
        { targetId: buildImmediateWelcomePopupTargetId(input.leadId) },
        { targetId: { startsWith: `${buildImmediateWelcomePopupTargetId(input.leadId)}:retry:` } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      targetId: true,
    },
  });

  const clickToken = randomUUID();
  const trackedCtaUrl = `${env.NEXT_PUBLIC_SITE_URL}/api/email/click/${clickToken}`;
  const subject = welcomePopupCopy.emailSubject;
  const html = renderMarketingEmail({
    subject,
    previewText: welcomePopupCopy.emailPreview,
    bodyText: welcomePopupCopy.emailBody,
    ctaLabel: welcomePopupCopy.successPrimaryAction,
    ctaUrl: trackedCtaUrl,
    coupon: {
      code: input.coupon.code,
      discountType: input.coupon.discountType,
      discountPercentage: input.coupon.discountPercentage,
      fixedDiscountArs: input.coupon.fixedDiscountArs,
      headline: welcomePopupCopy.emailCouponHeadline,
      message: welcomePopupCopy.emailCouponMessage,
    },
  });
  const targetId =
    latestAttempt?.status === EmailSendStatus.ERROR
      ? `${buildImmediateWelcomePopupTargetId(input.leadId)}:retry:${Date.now()}`
      : buildImmediateWelcomePopupTargetId(input.leadId);

  try {
    const sent = await sendEmail({
      fromEmail: env.EMAIL_FROM_DEFAULT,
      senderName: "IQ Kids",
      replyToEmail: env.EMAIL_REPLY_TO_DEFAULT,
      to: input.email,
      subject,
      html,
      text: [
        welcomePopupCopy.emailSubject,
        welcomePopupCopy.emailBody,
        `Cupón: ${input.coupon.code}`,
        `Beneficio: ${input.coupon.discountLabel}`,
      ].join("\n\n"),
    });

    await createWelcomePopupEmailLog({
      automationId,
      recipientEmail: input.email,
      targetId,
      leadId: input.leadId,
      status: EmailSendStatus.SENT,
      subject,
      ctaUrl: POPUP_CTA_URL,
      clickToken,
      providerMessageId: sent.providerMessageId,
    });

    return true;
  } catch (error) {
    await createWelcomePopupEmailLog({
      automationId,
      recipientEmail: input.email,
      targetId,
      leadId: input.leadId,
      status: EmailSendStatus.ERROR,
      subject,
      ctaUrl: POPUP_CTA_URL,
      clickToken,
      errorMessage: error instanceof Error ? error.message : "Email error",
    });
    console.error("Welcome popup email error", error);
    return false;
  }
}

async function logImmediateWelcomePopupSkipped(input: {
  email: string;
  leadId: string;
  reason: string;
  coupon: WelcomePopupCoupon;
}) {
  const automationId = await ensureImmediateWelcomePopupAutomation(input.coupon);

  await createWelcomePopupEmailLog({
    automationId,
    recipientEmail: input.email,
    targetId: buildImmediateWelcomePopupTargetId(input.leadId),
    leadId: input.leadId,
    status: EmailSendStatus.SKIPPED,
    subject: welcomePopupCopy.emailSubject,
    errorMessage: input.reason,
  });

  return false;
}

async function ensureImmediateWelcomePopupAutomation(coupon: WelcomePopupCoupon) {
  const automation = await prisma.emailAutomation.upsert({
    where: { id: WELCOME_POPUP_IMMEDIATE_AUTOMATION_ID },
    update: {
      name: WELCOME_POPUP_IMMEDIATE_AUTOMATION_NAME,
      trigger: EmailAutomationTrigger.WELCOME_LEAD,
      active: false,
      delayHours: 0,
      subject: welcomePopupCopy.emailSubject,
      previewText: welcomePopupCopy.emailPreview,
      bodyText: welcomePopupCopy.emailBody,
      ctaLabel: welcomePopupCopy.successPrimaryAction,
      ctaUrlTemplate: POPUP_CTA_URL,
      senderName: "IQ Kids",
      fromEmail: env.EMAIL_FROM_DEFAULT,
      replyToEmail: env.EMAIL_REPLY_TO_DEFAULT,
      couponId: coupon.id,
      couponHeadline: welcomePopupCopy.emailCouponHeadline,
      couponMessage: welcomePopupCopy.emailCouponMessage,
    },
    create: {
      id: WELCOME_POPUP_IMMEDIATE_AUTOMATION_ID,
      name: WELCOME_POPUP_IMMEDIATE_AUTOMATION_NAME,
      trigger: EmailAutomationTrigger.WELCOME_LEAD,
      active: false,
      delayHours: 0,
      subject: welcomePopupCopy.emailSubject,
      previewText: welcomePopupCopy.emailPreview,
      bodyText: welcomePopupCopy.emailBody,
      ctaLabel: welcomePopupCopy.successPrimaryAction,
      ctaUrlTemplate: POPUP_CTA_URL,
      senderName: "IQ Kids",
      fromEmail: env.EMAIL_FROM_DEFAULT,
      replyToEmail: env.EMAIL_REPLY_TO_DEFAULT,
      couponId: coupon.id,
      couponHeadline: welcomePopupCopy.emailCouponHeadline,
      couponMessage: welcomePopupCopy.emailCouponMessage,
    },
    select: {
      id: true,
    },
  });

  return automation.id;
}

async function createWelcomePopupEmailLog(input: {
  automationId: string;
  recipientEmail: string;
  targetId: string;
  leadId: string;
  status: EmailSendStatus;
  subject: string;
  providerMessageId?: string | null;
  ctaUrl?: string | null;
  clickToken?: string | null;
  errorMessage?: string | null;
}) {
  try {
    await prisma.emailSendLog.create({
      data: {
        automationId: input.automationId,
        trigger: EmailAutomationTrigger.WELCOME_LEAD,
        status: input.status,
        recipientEmail: input.recipientEmail,
        subject: input.subject,
        targetType: "cart_recovery_lead",
        targetId: input.targetId,
        cartRecoveryLeadId: input.leadId,
        providerMessageId: input.providerMessageId,
        ctaUrl: input.ctaUrl,
        clickToken: input.clickToken,
        errorMessage: input.errorMessage,
        sentAt: input.status === EmailSendStatus.SENT ? new Date() : null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }

    throw error;
  }

  return true;
}
