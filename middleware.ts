import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return response;
  }

  if (request.nextUrl.pathname === "/admin/login") {
    return response;
  }

  if (env.devAdminBypass) {
    return response;
  }

  if (!env.hasSupabaseAuth) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("reason", "supabase-not-configured");

    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);

    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
