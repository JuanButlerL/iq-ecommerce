import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function safeRedirectUrl(value?: string | null) {
  if (!value) {
    return env.NEXT_PUBLIC_SITE_URL;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {
    return env.NEXT_PUBLIC_SITE_URL;
  }

  return env.NEXT_PUBLIC_SITE_URL;
}

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;

  if (!token || token.length > 120) {
    return NextResponse.redirect(env.NEXT_PUBLIC_SITE_URL);
  }

  const log = await prisma.emailSendLog.findUnique({
    where: { clickToken: token },
    select: {
      id: true,
      ctaUrl: true,
      firstClickedAt: true,
    },
  });

  if (!log) {
    return NextResponse.redirect(env.NEXT_PUBLIC_SITE_URL);
  }

  const now = new Date();

  await prisma.emailSendLog.update({
    where: { id: log.id },
    data: {
      clickCount: { increment: 1 },
      firstClickedAt: log.firstClickedAt ?? now,
      lastClickedAt: now,
    },
  });

  return NextResponse.redirect(safeRedirectUrl(log.ctaUrl));
}
