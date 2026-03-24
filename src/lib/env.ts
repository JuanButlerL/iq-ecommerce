import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_PRODUCT_BUCKET: z.string().default("product-images"),
  SUPABASE_PROOF_BUCKET: z.string().default("payment-proofs"),
  SUPABASE_PRODUCT_BUCKET_PUBLIC: z.enum(["true", "false"]).default("true"),
  SUPABASE_PROOF_SIGNED_URL_EXPIRES_IN: z.coerce.number().default(31536000),
  ORDER_SYNC_PROVIDER: z.enum(["mock", "google_sheets", "apps_script"]).default("mock"),
  ORDER_SYNC_SOURCE_LABEL: z.string().default("web"),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),
  APPS_SCRIPT_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  APPS_SCRIPT_API_KEY: z.string().optional(),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().default("admin@iqkids.local"),
  ADMIN_LOCAL_EMAIL: z.string().email().optional(),
  ADMIN_LOCAL_PASSWORD: z.string().min(8).optional(),
  ADMIN_SESSION_SECRET: z.string().min(16).optional(),
  ENABLE_PROOF_PUBLIC_URL_SYNC: z.enum(["true", "false"]).default("false"),
  DEV_ADMIN_BYPASS: z.enum(["true", "false"]).default("false"),
});

const parsedEnv = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_PRODUCT_BUCKET: process.env.SUPABASE_PRODUCT_BUCKET,
  SUPABASE_PROOF_BUCKET: process.env.SUPABASE_PROOF_BUCKET,
  SUPABASE_PRODUCT_BUCKET_PUBLIC: process.env.SUPABASE_PRODUCT_BUCKET_PUBLIC,
  SUPABASE_PROOF_SIGNED_URL_EXPIRES_IN: process.env.SUPABASE_PROOF_SIGNED_URL_EXPIRES_IN,
  ORDER_SYNC_PROVIDER: process.env.ORDER_SYNC_PROVIDER,
  ORDER_SYNC_SOURCE_LABEL: process.env.ORDER_SYNC_SOURCE_LABEL,
  GOOGLE_SHEETS_SPREADSHEET_ID: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  APPS_SCRIPT_WEBHOOK_URL: process.env.APPS_SCRIPT_WEBHOOK_URL,
  APPS_SCRIPT_API_KEY: process.env.APPS_SCRIPT_API_KEY,
  ADMIN_BOOTSTRAP_EMAIL: process.env.ADMIN_BOOTSTRAP_EMAIL,
  ADMIN_LOCAL_EMAIL: process.env.ADMIN_LOCAL_EMAIL,
  ADMIN_LOCAL_PASSWORD: process.env.ADMIN_LOCAL_PASSWORD,
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET,
  ENABLE_PROOF_PUBLIC_URL_SYNC: process.env.ENABLE_PROOF_PUBLIC_URL_SYNC,
  DEV_ADMIN_BYPASS: process.env.DEV_ADMIN_BYPASS,
});

export const env = {
  ...parsedEnv,
  isProduction: process.env.NODE_ENV === "production",
  isProductBucketPublic: parsedEnv.SUPABASE_PRODUCT_BUCKET_PUBLIC === "true",
  enableProofPublicUrlSync: parsedEnv.ENABLE_PROOF_PUBLIC_URL_SYNC === "true",
  devAdminBypass: parsedEnv.DEV_ADMIN_BYPASS === "true" && process.env.NODE_ENV !== "production",
  hasLocalAdminAuth:
    Boolean(parsedEnv.ADMIN_LOCAL_EMAIL) &&
    Boolean(parsedEnv.ADMIN_LOCAL_PASSWORD) &&
    Boolean(parsedEnv.ADMIN_SESSION_SECRET),
  localAdminUsesDefaultEmail: parsedEnv.ADMIN_LOCAL_EMAIL === "admin@iqkids.local",
  localAdminUsesDefaultPassword: parsedEnv.ADMIN_LOCAL_PASSWORD === "Cambiame123!",
  localAdminUsesDefaultSecret: parsedEnv.ADMIN_SESSION_SECRET === "iqkids-local-admin-secret",
  hasSupabaseAuth:
    Boolean(parsedEnv.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(parsedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    !String(parsedEnv.NEXT_PUBLIC_SUPABASE_URL).includes("your-project.supabase.co") &&
    !String(parsedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY).includes("your-anon-key"),
  hasSupabaseAdmin:
    Boolean(parsedEnv.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(parsedEnv.SUPABASE_SERVICE_ROLE_KEY) &&
    !String(parsedEnv.NEXT_PUBLIC_SUPABASE_URL).includes("your-project.supabase.co") &&
    !String(parsedEnv.SUPABASE_SERVICE_ROLE_KEY).includes("your-service-role-key"),
  canUseLocalAdminAuth:
    Boolean(parsedEnv.ADMIN_LOCAL_EMAIL) &&
    Boolean(parsedEnv.ADMIN_LOCAL_PASSWORD) &&
    Boolean(parsedEnv.ADMIN_SESSION_SECRET) &&
    (process.env.NODE_ENV !== "production" ||
      (parsedEnv.ADMIN_LOCAL_PASSWORD !== "Cambiame123!" &&
        parsedEnv.ADMIN_SESSION_SECRET !== "iqkids-local-admin-secret")),
};

export function requireServerEnv(key: keyof typeof parsedEnv) {
  const value = parsedEnv[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return String(value);
}
