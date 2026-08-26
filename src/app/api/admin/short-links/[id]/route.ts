import { Prisma } from "@prisma/client";

import { assertAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";
import { shortLinkSchema } from "@/lib/validations/short-link";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertAdminSection("links");
    const { id } = await params;
    const parsed = shortLinkSchema.parse(await request.json());

    await prisma.shortLink.update({
      where: { id },
      data: {
        slug: parsed.slug,
        targetUrl: parsed.targetUrl,
        title: parsed.title || null,
        description: parsed.description || null,
        active: parsed.active,
      },
    });

    return routeOk({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return routeError(new AppError("Ya existe un link con ese nombre.", 409, true));
    }

    return routeError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertAdminSection("links");
    const { id } = await params;

    await prisma.shortLink.delete({
      where: { id },
    });

    return routeOk({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
