import { NextResponse } from "next/server";

import { assertAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { routeError, routeOk } from "@/lib/http/route";
import { emailAutomationSchema } from "@/lib/validations/email-automation";

export async function POST(request: Request) {
  try {
    await assertAdminSection("emails");
    const parsed = emailAutomationSchema.parse(await request.json());
    const automation = await prisma.emailAutomation.create({
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

export async function GET() {
  return NextResponse.json({ ok: true });
}
