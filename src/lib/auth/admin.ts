import { AdminRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { getLocalAdminSession } from "@/lib/auth/local-admin";
import { canAccessAdminSection, getFirstAccessibleAdminHref, isPrincipalAdminEmail, type AdminSectionId } from "@/lib/auth/admin-permissions";
import { createSupabaseServerClient } from "@/lib/auth/supabase/server";
import { AppError } from "@/lib/errors/app-error";

export async function getAdminSession() {
  if (env.devAdminBypass) {
    return {
      user: {
        id: "dev-admin",
        email: "dev-admin@local",
      },
      adminUser: {
        id: "dev-admin",
        supabaseUserId: "dev-admin",
        email: "dev-admin@local",
        fullName: "Local Dev Admin",
        role: AdminRole.SUPER_ADMIN,
        allowedSections: [],
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      isBootstrap: true,
    };
  }

  if (env.canUseLocalAdminAuth) {
    const localSession = await getLocalAdminSession();

    if (localSession?.email) {
      const adminUser = await prisma.adminUser.findUnique({
        where: { email: localSession.email },
      });
      const isPrincipal = isPrincipalAdminEmail(localSession.email, env.ADMIN_LOCAL_EMAIL);

      if (adminUser && !adminUser.active) {
        return null;
      }

      if (!adminUser && !isPrincipal) {
        return null;
      }

      return {
        user: {
          id: adminUser?.supabaseUserId ?? "local-admin",
          email: localSession.email,
        },
        adminUser: adminUser ?? {
          id: "local-admin",
          supabaseUserId: null,
          email: localSession.email,
          fullName: "Local Admin",
          role: AdminRole.SUPER_ADMIN,
          allowedSections: [],
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        isBootstrap: localSession.email === env.ADMIN_BOOTSTRAP_EMAIL,
      };
    }
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { email: user.email },
  });

  const isBootstrap = user.email === env.ADMIN_BOOTSTRAP_EMAIL;

  if (!adminUser && !isBootstrap) {
    return null;
  }

  if (adminUser && !adminUser.active) {
    return null;
  }

  if (adminUser && !adminUser.supabaseUserId && user.id) {
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { supabaseUserId: user.id },
    });
  }

  return {
    user,
    adminUser: adminUser ?? {
      id: "bootstrap-admin",
      supabaseUserId: user.id,
      email: user.email,
      fullName: "Bootstrap Admin",
      role: AdminRole.SUPER_ADMIN,
      allowedSections: [],
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    isBootstrap,
  };
}

export async function requireAdmin() {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return session;
}

export async function requireAdminSection(section: AdminSectionId) {
  const session = await requireAdmin();

  if (!canAccessAdminSection(session.adminUser, section, env.ADMIN_LOCAL_EMAIL)) {
    redirect(getFirstAccessibleAdminHref(session.adminUser, env.ADMIN_LOCAL_EMAIL));
  }

  return session;
}

export async function assertAdminSection(section: AdminSectionId) {
  const session = await getAdminSession();

  if (!session) {
    throw new AppError("No autorizado.", 401, true);
  }

  if (!canAccessAdminSection(session.adminUser, section, env.ADMIN_LOCAL_EMAIL)) {
    throw new AppError("No tenes permiso para esta seccion.", 403, true);
  }

  return session;
}

export async function requirePrincipalAdmin() {
  const session = await requireAdmin();

  if (!isPrincipalAdminEmail(session.adminUser.email, env.ADMIN_LOCAL_EMAIL)) {
    redirect(getFirstAccessibleAdminHref(session.adminUser, env.ADMIN_LOCAL_EMAIL));
  }

  return session;
}

export async function assertPrincipalAdmin() {
  const session = await getAdminSession();

  if (!session) {
    throw new AppError("No autorizado.", 401, true);
  }

  if (!isPrincipalAdminEmail(session.adminUser.email, env.ADMIN_LOCAL_EMAIL)) {
    throw new AppError("Solo el administrador principal puede gestionar usuarios.", 403, true);
  }

  return session;
}
