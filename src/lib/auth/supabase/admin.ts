import { createClient } from "@supabase/supabase-js";

import { env, requireServerEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  if (!env.hasSupabaseAdmin) {
    throw new Error("Supabase admin client is not configured.");
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL ?? requireServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
