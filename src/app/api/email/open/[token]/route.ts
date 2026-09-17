import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";

type RouteContext = {
  params: Promise<{ token: string }>;
};

const transparentGif = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64",
);

function pixelResponse() {
  return new NextResponse(transparentGif, {
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(transparentGif.length),
      "Cache-Control": "no-store, private, max-age=0",
    },
  });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;

    if (!token || token.length > 120) {
      return pixelResponse();
    }

    const log = await prisma.emailSendLog.findUnique({
      where: { openToken: token },
      select: { id: true, firstOpenedAt: true },
    });

    if (!log) {
      return pixelResponse();
    }

    const now = new Date();

    await prisma.emailSendLog.update({
      where: { id: log.id },
      data: {
        openCount: { increment: 1 },
        firstOpenedAt: log.firstOpenedAt ?? now,
        lastOpenedAt: now,
      },
    });
  } catch (error) {
    console.error("Email open tracking error", error);
  }

  return pixelResponse();
}
