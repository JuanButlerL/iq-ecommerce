import { Prisma } from "@prisma/client";

import { assertAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";
import { shortLinkSchema } from "@/lib/validations/short-link";

export async function POST(request: Request) {
  try {
    await assertAdminSection("links");
    const parsed = shortLinkSchema.parse(await request.json());

    const link = await prisma.shortLink.create({
      data: {
        slug: parsed.slug,
        targetUrl: parsed.targetUrl,
        title: parsed.title || null,
        description: parsed.description || null,
        active: parsed.active,
      },
    });

    return routeOk({ id: link.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return routeError(new AppError("Ya existe un link con ese nombre.", 409, true));
    }

    return routeError(error);
  }
}
