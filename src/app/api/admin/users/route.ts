import { AdminRole } from "@prisma/client";
import { z } from "zod";

import { assertPrincipalAdmin } from "@/lib/auth/admin";
import { normalizeAdminSections } from "@/lib/auth/admin-permissions";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";

const createAdminUserSchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(120),
  role: z.nativeEnum(AdminRole).default(AdminRole.OPERATIONS),
  allowedSections: z.array(z.string()).default([]),
  active: z.boolean().default(true),
});

export async function POST(request: Request) {
  try {
    await assertPrincipalAdmin();
    const parsed = createAdminUserSchema.parse(await request.json());
    const email = parsed.email.toLowerCase();

    if (email === env.ADMIN_LOCAL_EMAIL?.toLowerCase()) {
      throw new AppError("El usuario principal se administra desde variables de entorno.", 400, true);
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } });

    if (existing) {
      throw new AppError("Ya existe un usuario admin con ese email.", 409, true);
    }

    const user = await prisma.adminUser.create({
      data: {
        email,
        fullName: parsed.fullName,
        passwordHash: await hashPassword(parsed.password),
        role: parsed.role,
        allowedSections: parsed.role === AdminRole.OPERATIONS ? normalizeAdminSections(parsed.allowedSections) : [],
        active: parsed.active,
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

    return routeOk(user, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
