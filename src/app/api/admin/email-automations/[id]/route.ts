import { assertAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";
import { emailAutomationSchema } from "@/lib/validations/email-automation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await assertAdminSection("emails");
    const { id } = await context.params;
    const parsed = emailAutomationSchema.parse(await request.json());
    const automation = await prisma.emailAutomation.update({
      where: { id },
      data: {
        ...parsed,
        previewText: parsed.previewText || null,
        ctaLabel: parsed.ctaLabel || null,
        ctaUrlTemplate: parsed.ctaUrlTemplate || null,
        replyToEmail: parsed.replyToEmail || null,
        bccEmail: parsed.bccEmail || null,
        couponId: parsed.couponId || null,
        couponHeadline: parsed.couponHeadline || null,
        couponMessage: parsed.couponMessage || null,
      },
    });

    return routeOk({ id: automation.id });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await assertAdminSection("emails");
    const { id } = await context.params;
    const existing = await prisma.emailAutomation.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError("Automatizacion no encontrada.", 404, true);
    }

    await prisma.emailAutomation.delete({ where: { id } });

    return routeOk({ id });
  } catch (error) {
    return routeError(error);
  }
}
