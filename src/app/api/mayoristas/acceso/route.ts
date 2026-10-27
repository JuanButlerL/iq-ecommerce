import { NextResponse } from "next/server";

import {
  WHOLESALE_ACCESS_COOKIE,
  WHOLESALE_ACCESS_MAX_AGE_SECONDS,
  buildWholesaleAccessToken,
  isWholesaleAccessBlocked,
  registerWholesaleAccessFailure,
  verifyWholesalePassword,
} from "@/features/wholesale/access";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";

  if (isWholesaleAccessBlocked(ip)) {
    return NextResponse.json({ error: "Demasiados intentos. Probá de nuevo en unos minutos." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password.slice(0, 200) : "";
  const content = await getWholesaleContent();

  if (!content.accessPasswordHash) {
    return NextResponse.json({ data: { ok: true } });
  }

  if (!password || !verifyWholesalePassword(password, content.accessPasswordHash)) {
    registerWholesaleAccessFailure(ip);
    return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }

  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(WHOLESALE_ACCESS_COOKIE, buildWholesaleAccessToken(content.accessPasswordHash), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NEXT_PUBLIC_SITE_URL.startsWith("https://"),
    path: "/",
    maxAge: WHOLESALE_ACCESS_MAX_AGE_SECONDS,
  });

  return response;
}
