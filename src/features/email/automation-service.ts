import { randomUUID } from "crypto";
import { EmailAutomationTrigger, EmailSendStatus, NewsletterSubscriberStatus, OrderStatus, PaymentStatus, Prisma } from "@prisma/client";

import { sendEmail } from "@/features/email/provider";
import { renderMarketingEmail, renderTemplate } from "@/features/email/render";
import { grantCartRecoveryFreeShippingBenefit } from "@/features/cart-recovery/free-shipping-service";
import { WELCOME_POPUP_IMMEDIATE_AUTOMATION_ID } from "@/features/email/system-automations";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { formatArs } from "@/lib/utils/currency";

const DEFAULT_LIMIT = 100;

type ProcessResult = {
  automationId: string;
  automationName: string;
  sent: number;
  skipped: number;
  errors: number;
};

type Candidate = {
  targetType: "cart_recovery_lead" | "order";
  targetId: string;
  recipientEmail: string;
  orderId?: string;
  cartRecoveryLeadId?: string;
  variables: Record<string, string | number | null | undefined>;
};

type CartRecoveryLeadTriggerSnapshot = {
  createdAt: Date;
  updatedAt: Date;
  checkoutStartedAt: Date | null;
  status: string;
};

type CartRecoveryLeadPreviewSnapshot = CartRecoveryLeadTriggerSnapshot & {
  id: string;
  email: string;
  subtotalArs: number;
};

export async function processEmailAutomations(options: { automationId?: string; limit?: number } = {}) {
  const automations = await prisma.emailAutomation.findMany({
    where: {
      active: true,
      id: options.automationId ?? { not: WELCOME_POPUP_IMMEDIATE_AUTOMATION_ID },
    },
    include: {
      coupon: true,
    },
    orderBy: [{ trigger: "asc" }, { createdAt: "asc" }],
  });
  const results: ProcessResult[] = [];

  for (const automation of automations) {
    const candidates = await getCandidatesForAutomation(automation, options.limit ?? DEFAULT_LIMIT);
    const result: ProcessResult = {
      automationId: automation.id,
      automationName: automation.name,
      sent: 0,
      skipped: 0,
      errors: 0,
    };

    for (const candidate of candidates) {
      const existingLog = await prisma.emailSendLog.findFirst({
        where: {
          automationId: automation.id,
          targetType: candidate.targetType,
          OR: [{ targetId: candidate.targetId }, { targetId: { startsWith: `${candidate.targetId}:retry:` } }],
        },
        orderBy: { createdAt: "desc" },
      });

      let targetId = candidate.targetId;

      if (existingLog && existingLog.status !== EmailSendStatus.ERROR) {
        result.skipped += 1;
        continue;
      }

      if (existingLog?.status === EmailSendStatus.ERROR) {
        targetId = `${candidate.targetId}:retry:${Date.now()}`;
      }

      const subject = renderTemplate(automation.subject, candidate.variables);
      const previewText = automation.previewText ? renderTemplate(automation.previewText, candidate.variables) : null;
      const bodyText = renderTemplate(automation.bodyText, candidate.variables);
      const ctaLabel = automation.ctaLabel ? renderTemplate(automation.ctaLabel, candidate.variables) : null;
      const ctaUrl = automation.ctaUrlTemplate ? renderTemplate(automation.ctaUrlTemplate, candidate.variables) : null;
      const logId = randomUUID();
      const openToken = randomUUID();
      const clickToken = ctaUrl ? randomUUID() : null;
      const trackedCtaUrl = clickToken ? `${env.NEXT_PUBLIC_SITE_URL}/api/email/click/${clickToken}` : null;
      const html = renderMarketingEmail({
        subject,
        previewText,
        bodyText,
        ctaLabel,
        ctaUrl: trackedCtaUrl ?? ctaUrl,
        openTrackingUrl: `${env.NEXT_PUBLIC_SITE_URL}/api/email/open/${openToken}`,
        coupon: automation.coupon
          ? {
              code: automation.coupon.code,
              discountType: automation.coupon.discountType,
              discountPercentage: automation.coupon.discountPercentage == null ? null : Number(automation.coupon.discountPercentage),
              fixedDiscountArs: automation.coupon.fixedDiscountArs ?? null,
              headline: automation.couponHeadline,
              message: automation.couponMessage,
            }
          : null,
      });

      try {
        const sent = await sendEmail({
          fromEmail: automation.fromEmail || env.EMAIL_FROM_DEFAULT,
          senderName: automation.senderName || "IQ Kids",
          replyToEmail: automation.replyToEmail,
          to: candidate.recipientEmail,
          subject,
          html,
          text: [subject, bodyText, ctaLabel && ctaUrl ? `${ctaLabel}: ${ctaUrl}` : ""].filter(Boolean).join("\n\n"),
          bccEmail: automation.bccEmail,
        });

        await createEmailLog({
          id: logId,
          automationId: automation.id,
          trigger: automation.trigger,
          status: EmailSendStatus.SENT,
          recipientEmail: candidate.recipientEmail,
          subject,
          targetType: candidate.targetType,
          targetId,
          orderId: candidate.orderId,
          cartRecoveryLeadId: candidate.cartRecoveryLeadId,
          providerMessageId: sent.providerMessageId,
          ctaUrl,
          clickToken,
          openToken,
        });
        if (
          automation.trigger === EmailAutomationTrigger.CART_ABANDONED &&
          candidate.cartRecoveryLeadId &&
          ctaUrl === candidate.variables.recoveryUrl
        ) {
          await grantCartRecoveryFreeShippingBenefit(candidate.cartRecoveryLeadId);
        }
        result.sent += 1;
      } catch (error) {
        await createEmailLog({
          id: logId,
          automationId: automation.id,
          trigger: automation.trigger,
          status: EmailSendStatus.ERROR,
          recipientEmail: candidate.recipientEmail,
          subject,
          targetType: candidate.targetType,
          targetId,
          orderId: candidate.orderId,
          cartRecoveryLeadId: candidate.cartRecoveryLeadId,
          ctaUrl,
          clickToken,
          openToken,
          errorMessage: error instanceof Error ? error.message : "Email error",
        });
        result.errors += 1;
      }
    }

    results.push(result);
  }

  return results;
}

export async function getEmailAutomationPreview(options: { logFrom?: Date; logTo?: Date } = {}) {
  const logCreatedAtWhere =
    options.logFrom || options.logTo
      ? {
          createdAt: {
            ...(options.logFrom ? { gte: options.logFrom } : {}),
            ...(options.logTo ? { lte: options.logTo } : {}),
          },
        }
      : {};

  const [automations, recentLogs, cartLeads, coupons, newsletterSubscribers] = await Promise.all([
    prisma.emailAutomation.findMany({
      where: {
        id: { not: WELCOME_POPUP_IMMEDIATE_AUTOMATION_ID },
      },
      orderBy: [{ active: "desc" }, { trigger: "asc" }, { name: "asc" }],
      include: {
        coupon: true,
        _count: {
          select: { logs: true },
        },
      },
    }),
    prisma.emailSendLog.findMany({
      take: 250,
      where: logCreatedAtWhere,
      orderBy: { createdAt: "desc" },
      include: {
        automation: {
          select: { name: true },
        },
        convertedOrder: {
          select: {
            publicOrderNumber: true,
            totalArs: true,
            paymentStatus: true,
            createdAt: true,
          },
        },
        order: {
          select: {
            publicOrderNumber: true,
            createdAt: true,
            paidAt: true,
            paymentStatus: true,
            totalArs: true,
            customerEmail: true,
            paymentProofs: {
              orderBy: { uploadedAt: "desc" },
              take: 1,
              select: { uploadedAt: true },
            },
          },
        },
        cartRecoveryLead: {
          select: {
            email: true,
            status: true,
            subtotalArs: true,
            createdAt: true,
            checkoutStartedAt: true,
            convertedAt: true,
            convertedOrderNumber: true,
          },
        },
      },
    }),
    prisma.cartRecoveryLead.findMany({
      take: 20,
      where: {
        status: { in: ["WELCOME_CAPTURED", "CAPTURED", "CHECKOUT_STARTED"] },
      },
      orderBy: [{ checkoutStartedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.coupon.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        discountType: true,
        discountPercentage: true,
        fixedDiscountArs: true,
        description: true,
      },
    }),
    prisma.newsletterSubscriber.count({
      where: { status: NewsletterSubscriberStatus.SUBSCRIBED },
    }),
  ]);

  const logsWithOpens = recentLogs.filter((log) => log.openCount > 0).length;
  const logsWithClicks = recentLogs.filter((log) => log.clickCount > 0).length;
  const logsWithConversions = recentLogs.filter((log) => log.convertedAt).length;
  const leadIds = cartLeads.map((lead) => lead.id);
  const cartLeadCycles = new Map(
    cartLeads.map((lead) => [lead.id, buildCartRecoveryTargetId(lead.id, getCartRecoveryLeadCycleDate(lead))] as const),
  );
  const leadLogs = leadIds.length
    ? await prisma.emailSendLog.findMany({
        where: {
          trigger: { in: [EmailAutomationTrigger.WELCOME_LEAD, EmailAutomationTrigger.CART_ABANDONED] },
          OR: [
            { cartRecoveryLeadId: { in: leadIds } },
            {
              targetType: "cart_recovery_lead",
              OR: leadIds.map((leadId) => ({
                targetId: {
                  startsWith: leadId,
                },
              })),
            },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: {
          automation: {
            select: { name: true },
          },
        },
      })
    : [];

  return {
    automations: automations.map((automation) => ({
      ...automation,
      coupon: serializeCouponPreview(automation.coupon),
    })),
    recentLogs,
    cartLeads: cartLeads.map((lead) =>
      buildCartRecoveryLeadPreview(
        lead,
        getCartRecoveryCycleLog(
          cartLeadCycles.get(lead.id) ?? buildCartRecoveryTargetId(lead.id, getCartRecoveryLeadCycleDate(lead)),
          lead.id,
          leadLogs,
        ),
        getCartRecoveryLeadTrigger(lead),
      ),
    ),
    coupons: coupons.map((coupon) => ({
      ...coupon,
      discountPercentage: coupon.discountPercentage == null ? null : Number(coupon.discountPercentage),
    })),
    trackingSummary: {
      opened: logsWithOpens,
      clicked: logsWithClicks,
      converted: logsWithConversions,
      sent: recentLogs.filter((log) => log.status === EmailSendStatus.SENT).length,
    },
    newsletterSubscribers,
    emailEnabled: env.canSendEmail,
  };
}

export async function getEmailAuditPreview(options: { logFrom?: Date; logTo?: Date } = {}) {
  const preview = await getEmailAutomationPreview(options);

  return {
    recentLogs: preview.recentLogs,
    emailEnabled: preview.emailEnabled,
  };
}

async function getCandidatesForAutomation(
  automation: { id: string; trigger: EmailAutomationTrigger; delayHours: number },
  limit: number,
): Promise<Candidate[]> {
  const readyAt = new Date(Date.now() - Math.max(automation.delayHours, 0) * 60 * 60 * 1000);

  if (automation.trigger === EmailAutomationTrigger.WELCOME_LEAD) {
    const leads = await prisma.cartRecoveryLead.findMany({
      take: limit,
      where: {
        status: "WELCOME_CAPTURED",
        updatedAt: { lte: readyAt },
      },
      orderBy: { updatedAt: "asc" },
      include: {
        emailLogs: {
          where: {
            trigger: EmailAutomationTrigger.WELCOME_LEAD,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    const candidates: Candidate[] = [];

    for (const lead of leads) {
      const cycleDate = lead.updatedAt;
      const cycleTargetId = buildCartRecoveryTargetId(lead.id, cycleDate);
      const latestLog = getCartRecoveryCycleLog(cycleTargetId, lead.id, lead.emailLogs);

      const convertedLater = await prisma.order.findFirst({
        where: {
          customerEmail: {
            equals: lead.email,
            mode: "insensitive",
          },
          createdAt: {
            gte: cycleDate,
          },
          orderStatus: {
            notIn: [OrderStatus.CANCELLED, OrderStatus.EXPIRED],
          },
          paymentStatus: {
            in: [PaymentStatus.PROOF_UPLOADED, PaymentStatus.PAID],
          },
        },
        select: { id: true, publicOrderNumber: true },
      });

      if (convertedLater) {
        await prisma.cartRecoveryLead.update({
          where: { id: lead.id },
          data: {
            status: "CONVERTED",
            convertedOrderId: convertedLater.id,
            convertedOrderNumber: convertedLater.publicOrderNumber,
            convertedAt: new Date(),
          },
        });

        await createEmailLog({
          automationId: automation.id,
          trigger: automation.trigger,
          status: EmailSendStatus.SKIPPED,
          recipientEmail: lead.email,
          subject: "Skipped: customer converted",
          targetType: "cart_recovery_lead",
          targetId: cycleTargetId,
          cartRecoveryLeadId: lead.id,
          errorMessage: "Omitido: el email ya tiene una compra posterior confirmada.",
        });
        continue;
      }

      if (latestLog?.status === EmailSendStatus.SENT && latestLog.createdAt >= cycleDate) {
        continue;
      }

      candidates.push({
        targetType: "cart_recovery_lead",
        targetId: cycleTargetId,
        recipientEmail: lead.email,
        cartRecoveryLeadId: lead.id,
        variables: {
          email: lead.email,
          siteUrl: env.NEXT_PUBLIC_SITE_URL,
        },
      });
    }

    return candidates;
  }

  if (automation.trigger === EmailAutomationTrigger.CART_ABANDONED) {
    const leads = await prisma.cartRecoveryLead.findMany({
      where: {
        status: { in: ["CAPTURED", "CHECKOUT_STARTED"] },
        OR: [
          {
            status: "CAPTURED",
            updatedAt: { lte: readyAt },
          },
          {
            status: "CHECKOUT_STARTED",
            checkoutStartedAt: { lte: readyAt },
          },
        ],
      },
      orderBy: [{ checkoutStartedAt: "asc" }, { createdAt: "asc" }],
      include: {
        emailLogs: {
          where: {
            trigger: EmailAutomationTrigger.CART_ABANDONED,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });
    const candidates: Candidate[] = [];

    for (const lead of leads.sort((a, b) => getCartRecoveryLeadCycleDate(a).getTime() - getCartRecoveryLeadCycleDate(b).getTime())) {
      const cycleDate = getCartRecoveryLeadCycleDate(lead);
      const cycleTargetId = buildCartRecoveryTargetId(lead.id, cycleDate);
      const latestLog = getCartRecoveryCycleLog(cycleTargetId, lead.id, lead.emailLogs);

      const convertedLater = await prisma.order.findFirst({
        where: {
          customerEmail: {
            equals: lead.email,
            mode: "insensitive",
          },
          createdAt: {
            gte: cycleDate,
          },
          orderStatus: {
            notIn: [OrderStatus.CANCELLED, OrderStatus.EXPIRED],
          },
          paymentStatus: {
            in: [PaymentStatus.PROOF_UPLOADED, PaymentStatus.PAID],
          },
        },
        select: { id: true, publicOrderNumber: true },
      });

      if (convertedLater) {
        await prisma.cartRecoveryLead.update({
          where: { id: lead.id },
          data: {
            status: "CONVERTED",
            convertedOrderId: convertedLater.id,
            convertedOrderNumber: convertedLater.publicOrderNumber,
            convertedAt: new Date(),
          },
        });

        await createEmailLog({
          automationId: automation.id,
          trigger: automation.trigger,
          status: EmailSendStatus.SKIPPED,
          recipientEmail: lead.email,
          subject: "Skipped: customer converted",
          targetType: "cart_recovery_lead",
          targetId: cycleTargetId,
          cartRecoveryLeadId: lead.id,
          errorMessage: "Omitido: el email ya tiene una compra posterior confirmada.",
        });
        continue;
      }

      if (latestLog?.status === EmailSendStatus.SENT && latestLog.createdAt >= cycleDate) {
        continue;
      }

      candidates.push({
        targetType: "cart_recovery_lead",
        targetId: cycleTargetId,
        recipientEmail: lead.email,
        cartRecoveryLeadId: lead.id,
        variables: {
          email: lead.email,
          recoveryUrl: `${env.NEXT_PUBLIC_SITE_URL}/carrito?recuperar=${lead.recoveryToken}`,
          siteUrl: env.NEXT_PUBLIC_SITE_URL,
          subtotal: formatArs(lead.subtotalArs),
        },
      });

      if (candidates.length >= limit) {
        break;
      }
    }

    return candidates;
  }

  if (automation.trigger === EmailAutomationTrigger.ORDER_CREATED) {
    const orders = await prisma.order.findMany({
      take: limit,
      where: {
        createdAt: { lte: readyAt },
        orderStatus: { notIn: [OrderStatus.CANCELLED, OrderStatus.EXPIRED] },
      },
      orderBy: { createdAt: "asc" },
    });

    return orders.map((order) => buildOrderCandidate(order));
  }

  const orders = await prisma.order.findMany({
    take: Math.max(limit * 3, limit),
    where: {
      paymentStatus: { in: [PaymentStatus.PROOF_UPLOADED, PaymentStatus.PAID] },
      orderStatus: { notIn: [OrderStatus.CANCELLED, OrderStatus.EXPIRED] },
      OR: [{ paidAt: { lte: readyAt } }, { paymentProofs: { some: { uploadedAt: { lte: readyAt } } } }],
    },
    orderBy: { createdAt: "asc" },
    include: {
      paymentProofs: {
        orderBy: { uploadedAt: "desc" },
        take: 1,
      },
    },
  });

  return orders
    .filter((order) => getPostPurchaseEventDate(order) <= readyAt)
    .slice(0, limit)
    .map((order) => buildOrderCandidate(order));
}

function getCartRecoveryLeadCycleDate(lead: CartRecoveryLeadTriggerSnapshot) {
  // Saving a changed cart refreshes updatedAt, but must never postpone an already scheduled recovery.
  return lead.status === "CHECKOUT_STARTED" && lead.checkoutStartedAt ? lead.checkoutStartedAt : lead.createdAt;
}

function getCartRecoveryLeadTrigger(lead: { status: string }) {
  return lead.status === "WELCOME_CAPTURED" ? EmailAutomationTrigger.WELCOME_LEAD : EmailAutomationTrigger.CART_ABANDONED;
}

type SerializableCouponPreview = {
  id: string;
  code: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountPercentage: number | null;
  fixedDiscountArs: number | null;
  description: string | null;
};

function serializeCouponPreview(
  coupon:
    | {
        id: string;
        code: string;
        discountType: "PERCENTAGE" | "FIXED_AMOUNT";
        discountPercentage: Prisma.Decimal | number | string | null;
        fixedDiscountArs: number | null;
        description: string | null;
      }
    | null,
): SerializableCouponPreview | null {
  if (!coupon) {
    return null;
  }

  return {
    ...coupon,
    discountPercentage: coupon.discountPercentage == null ? null : Number(coupon.discountPercentage),
  };
}

function buildCartRecoveryLeadPreview(
  lead: CartRecoveryLeadPreviewSnapshot,
  latestLog: {
    id: string;
    status: EmailSendStatus;
    sentAt: Date | null;
    createdAt: Date;
    errorMessage: string | null;
    automation: {
      name: string;
    };
  } | null,
  trigger: EmailAutomationTrigger,
) {
  return {
    id: lead.id,
    email: lead.email,
    trigger,
    status: lead.status,
    subtotalArs: lead.subtotalArs,
    triggerAt: getCartRecoveryLeadCycleDate(lead),
    latestLog: latestLog
      ? {
          id: latestLog.id,
          status: latestLog.status,
          sentAt: latestLog.sentAt,
          createdAt: latestLog.createdAt,
          errorMessage: latestLog.errorMessage,
          automationName: latestLog.automation.name,
        }
      : null,
  };
}

function buildCartRecoveryTargetId(leadId: string, cycleDate: Date) {
  return `${leadId}:${cycleDate.getTime()}`;
}

function extractLeadIdFromTargetId(targetId: string) {
  return targetId.split(":")[0] || null;
}

function getCartRecoveryCycleLog<T extends { targetId: string; createdAt: Date; cartRecoveryLeadId?: string | null }>(
  cycleTargetId: string,
  leadId: string,
  logs: T[],
) {
  const leadLogs = logs.filter((log) => (log.cartRecoveryLeadId ?? extractLeadIdFromTargetId(log.targetId)) === leadId);

  return (
    leadLogs.find((log) => log.targetId === cycleTargetId || log.targetId.startsWith(`${cycleTargetId}:retry:`)) ??
    // Recoveries sent before the stable cycle anchor used updatedAt in their target id.
    // A lead is unique per active 24-hour window, so its latest log remains the same cycle.
    leadLogs[0] ??
    null
  );
}

export async function markEmailClicksConverted(order: {
  id: string;
  publicOrderNumber: string;
  customerEmail: string;
}) {
  await prisma.emailSendLog.updateMany({
    where: {
      recipientEmail: {
        equals: order.customerEmail.toLowerCase(),
        mode: "insensitive",
      },
      status: EmailSendStatus.SENT,
      firstClickedAt: { not: null },
      convertedOrderId: null,
      createdAt: { lte: new Date() },
    },
    data: {
      convertedOrderId: order.id,
      convertedOrderNumber: order.publicOrderNumber,
      convertedAt: new Date(),
    },
  });
}

function getPostPurchaseEventDate(order: { paidAt: Date | null; paymentProofs?: Array<{ uploadedAt: Date }> }) {
  return order.paidAt ?? order.paymentProofs?.[0]?.uploadedAt ?? new Date(0);
}

function buildOrderCandidate(order: {
  id: string;
  publicOrderNumber: string;
  customerEmail: string;
  customerFirstName: string;
  totalArs: number;
}) {
  return {
    targetType: "order" as const,
    targetId: order.id,
    recipientEmail: order.customerEmail,
    orderId: order.id,
    variables: {
      firstName: order.customerFirstName,
      orderNumber: order.publicOrderNumber,
      orderUrl: `${env.NEXT_PUBLIC_SITE_URL}/checkout/confirmacion/${order.publicOrderNumber}`,
      siteUrl: env.NEXT_PUBLIC_SITE_URL,
      total: formatArs(order.totalArs),
    },
  };
}

async function createEmailLog(input: Prisma.EmailSendLogUncheckedCreateInput) {
  try {
    return await prisma.emailSendLog.create({
      data: {
        ...input,
        sentAt: input.status === EmailSendStatus.SENT ? new Date() : input.sentAt,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }

    throw error;
  }
}


