import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";

type RouteContext = { params: Promise<{ token: string }> };

const transparentGif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

function pixelResponse() {
  return new NextResponse(transparentGif, {
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(transparentGif.length),
      "Cache-Control": "no-store, private, max-age=0",
    },
  });
}

// Always answers with the pixel, even on errors: tracking must never break an email.
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;

    if (!token || token.length > 120) {
      return pixelResponse();
    }

    const delivery = await prisma.newsletterDelivery.findUnique({ where: { openToken: token }, select: { id: true, firstOpenedAt: true } });

    if (delivery) {
      const now = new Date();
      await prisma.newsletterDelivery.update({
        where: { id: delivery.id },
        data: { openCount: { increment: 1 }, firstOpenedAt: delivery.firstOpenedAt ?? now, lastOpenedAt: now },
      });
    }
  } catch (error) {
    console.error(error);
  }

  return pixelResponse();
}
