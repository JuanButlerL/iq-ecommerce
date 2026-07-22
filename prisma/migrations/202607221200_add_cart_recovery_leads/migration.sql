CREATE TABLE IF NOT EXISTS "cart_recovery_leads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "recovery_token" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "subtotal_ars" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "province" TEXT,
  "status" TEXT NOT NULL DEFAULT 'CAPTURED',
  "checkout_order_id" UUID,
  "checkout_order_number" TEXT,
  "checkout_started_at" TIMESTAMP(3),
  "converted_order_id" UUID,
  "converted_order_number" TEXT,
  "converted_at" TIMESTAMP(3),
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cart_recovery_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cart_recovery_leads_recovery_token_key" ON "cart_recovery_leads"("recovery_token");
CREATE INDEX IF NOT EXISTS "cart_recovery_leads_email_idx" ON "cart_recovery_leads"("email");
CREATE INDEX IF NOT EXISTS "cart_recovery_leads_status_idx" ON "cart_recovery_leads"("status");
CREATE INDEX IF NOT EXISTS "cart_recovery_leads_updated_at_idx" ON "cart_recovery_leads"("updated_at");
