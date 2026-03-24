import { NextResponse } from "next/server";

import { AppError } from "@/lib/errors/app-error";
import { env } from "@/lib/env";
import { routeError } from "@/lib/http/route";
import { setLocalAdminSessionCookie, verifyLocalAdminCredentials } from "@/lib/auth/local-admin";

export async function POST(request: Request) {
  try {
    if (!env.hasLocalAdminAuth) {
      throw new AppError("El login admin local no esta configurado.", 400, true);
    }

    if (!env.canUseLocalAdminAuth) {
      throw new AppError(
        "Configura un usuario admin, una password segura y un ADMIN_SESSION_SECRET real antes de publicar.",
        500,
        true,
      );
    }

    const body = (await request.json()) as { email?: string; password?: string };

    if (!verifyLocalAdminCredentials(body.email, body.password)) {
      throw new AppError("Usuario o contrasena invalidos.", 401, true);
    }

    const response = NextResponse.json({ data: { ok: true } });
    setLocalAdminSessionCookie(response, body.email ?? "");
    return response;
  } catch (error) {
    return routeError(error);
  }
}
