import { AdminRole } from "@prisma/client";
import { z } from "zod";

import { assertPrincipalAdmin } from "@/lib/auth/admin";
import { normalizeAdminSections } from "@/lib/auth/admin-permissions";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";

const updateAdminUserSchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(120).optional(),
  role: z.nativeEnum(AdminRole).default(AdminRole.OPERATIONS),
  allowedSections: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertPrincipalAdmin();
    const { id } = await params;
    const parsed = updateAdminUserSchema.parse(await request.json());
    const email = parsed.email.toLowerCase();

    if (email === env.ADMIN_LOCAL_EMAIL?.toLowerCase()) {
      throw new AppError("El usuario principal se administra desde variables de entorno.", 400, true);
    }

    const existing = await prisma.adminUser.findUnique({ where: { id } });

    if (!existing) {
      throw new AppError("Usuario admin no encontrado.", 404, true);
    }

    const emailOwner = await prisma.adminUser.findUnique({ where: { email } });

    if (emailOwner && emailOwner.id !== id) {
      throw new AppError("Ya existe un usuario admin con ese email.", 409, true);
    }

    const user = await prisma.adminUser.update({
      where: { id },
      data: {
        email,
        fullName: parsed.fullName,
        role: parsed.role,
        allowedSections: parsed.role === AdminRole.OPERATIONS ? normalizeAdminSections(parsed.allowedSections) : [],
        active: parsed.active,
        ...(parsed.password ? { passwordHash: await hashPassword(parsed.password) } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        allowedSections: true,
        active: true,
      },
    });

    return routeOk(user);
  } catch (error) {
    return routeError(error);
  }
}
