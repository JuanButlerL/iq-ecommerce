import { AdminRole } from "@prisma/client";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { getLocalAdminSession } from "@/lib/auth/local-admin";
import { createSupabaseServerClient } from "@/lib/auth/supabase/server";

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

      if (adminUser && !adminUser.active) {
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
