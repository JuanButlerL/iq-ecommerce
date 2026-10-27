import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

type RouteContext = { params: Promise<{ token: string }> };

// Only redirects to links that exist in the email snapshot that was actually sent,
// so this route can never be abused as an open redirect.
function safeTarget(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request, context: RouteContext) {
  const fallback = env.NEXT_PUBLIC_SITE_URL;

  try {
    const { token } = await context.params;
    const index = Number(new URL(request.url).searchParams.get("l"));

    if (!token || token.length > 120 || !Number.isInteger(index) || index < 0) {
      return NextResponse.redirect(fallback);
    }

    const delivery = await prisma.newsletterDelivery.findUnique({
      where: { clickToken: token },
      select: { id: true, firstClickedAt: true, newsletter: { select: { emailSnapshot: true } } },
    });
    const links = (delivery?.newsletter.emailSnapshot as { links?: unknown[] } | null)?.links;
    const target = Array.isArray(links) ? safeTarget(links[index]) : null;

    if (!delivery || !target) {
      return NextResponse.redirect(fallback);
    }

    const now = new Date();
    await prisma.newsletterDelivery.update({
      where: { id: delivery.id },
      data: { clickCount: { increment: 1 }, firstClickedAt: delivery.firstClickedAt ?? now, lastClickedAt: now },
    });

    return NextResponse.redirect(target);
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(fallback);
  }
}
