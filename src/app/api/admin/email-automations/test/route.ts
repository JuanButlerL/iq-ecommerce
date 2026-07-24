import { EmailAutomationTrigger } from "@prisma/client";
import { z } from "zod";

import { renderMarketingEmail, renderTemplate } from "@/features/email/render";
import { sendEmail } from "@/features/email/provider";
import { assertAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";
import { formatArs } from "@/lib/utils/currency";
import { env } from "@/lib/env";

const testSchema = z.object({
  automationId: z.string().uuid(),
  to: z.string().trim().email(),
});

const sampleVariables = {
  email: "cliente@ejemplo.com",
  firstName: "Sofi",
  orderNumber: "26061000",
  subtotal: formatArs(21660),
  total: formatArs(28160),
  recoveryUrl: "",
  orderUrl: `${env.NEXT_PUBLIC_SITE_URL}/checkout/confirmacion/26061000`,
  siteUrl: env.NEXT_PUBLIC_SITE_URL,
};

export async function POST(request: Request) {
  try {
    await assertAdminSection("emails");
    const parsed = testSchema.parse(await request.json());
    const automation = await prisma.emailAutomation.findUnique({
      where: { id: parsed.automationId },
      include: { coupon: true },
    });

    if (!automation) {
      throw new AppError("Automatizacion no encontrada.", 404, true);
    }

    const variables = await buildTestVariables(automation.trigger, parsed.to);
    const subject = `[Prueba] ${renderTemplate(automation.subject, variables)}`;
    const previewText = automation.previewText ? renderTemplate(automation.previewText, variables) : null;
    const bodyText = renderTemplate(automation.bodyText, variables);
    const ctaLabel = automation.ctaLabel ? renderTemplate(automation.ctaLabel, variables) : null;
    const ctaUrl = automation.ctaUrlTemplate ? renderTemplate(automation.ctaUrlTemplate, variables) : null;
    const html = renderMarketingEmail({
      subject,
      previewText,
      bodyText,
      ctaLabel,
      ctaUrl,
      coupon: automation.coupon
        ? {
            code: automation.coupon.code,
            discountPercentage: Number(automation.coupon.discountPercentage),
            headline: automation.couponHeadline,
            message: automation.couponMessage,
          }
        : null,
    });
    const sent = await sendEmail({
      fromEmail: automation.fromEmail,
      senderName: automation.senderName,
      replyToEmail: automation.replyToEmail,
      to: parsed.to,
      subject,
      html,
      text: [subject, bodyText, ctaLabel && ctaUrl ? `${ctaLabel}: ${ctaUrl}` : ""].filter(Boolean).join("\n\n"),
      bccEmail: automation.bccEmail,
    });

    return routeOk({
      providerMessageId: sent.providerMessageId,
      recoveryUrl: variables.recoveryUrl || null,
    });
  } catch (error) {
    return routeError(error);
  }
}

async function buildTestVariables(trigger: EmailAutomationTrigger, testEmail: string) {
  if (trigger !== EmailAutomationTrigger.CART_ABANDONED) {
    return {
      ...sampleVariables,
      email: testEmail,
    };
  }

  const lead = await prisma.cartRecoveryLead.findFirst({
    where: {
      status: { in: ["CAPTURED", "CHECKOUT_STARTED"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!lead) {
    throw new AppError(
      "Para probar carrito abandonado primero generá un carrito real: agregá productos, cargá email en carrito y no termines la compra.",
      400,
      true,
    );
  }

  return {
    ...sampleVariables,
    email: lead.email,
    subtotal: formatArs(lead.subtotalArs),
    recoveryUrl: `${env.NEXT_PUBLIC_SITE_URL}/carrito?recuperar=${lead.recoveryToken}`,
  };
}
