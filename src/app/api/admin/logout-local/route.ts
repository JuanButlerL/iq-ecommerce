import { NextResponse } from "next/server";

import { clearLocalAdminSessionCookie } from "@/lib/auth/local-admin";

export async function POST() {
  const response = NextResponse.json({ data: { ok: true } });
  clearLocalAdminSessionCookie(response);
  return response;
}
