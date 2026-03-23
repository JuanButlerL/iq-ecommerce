"use client";

import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";

export function createSupabaseBrowserClient() {
  if (!env.hasSupabaseAuth) {
    throw new Error("Supabase Auth is not configured.");
  }

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
}
