ALTER TABLE "cart_recovery_leads"
  ADD COLUMN IF NOT EXISTS "checkout_order_id" UUID,
  ADD COLUMN IF NOT EXISTS "checkout_order_number" TEXT,
  ADD COLUMN IF NOT EXISTS "checkout_started_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "converted_order_id" UUID,
  ADD COLUMN IF NOT EXISTS "converted_order_number" TEXT,
  ADD COLUMN IF NOT EXISTS "converted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "cart_recovery_leads_status_idx" ON "cart_recovery_leads"("status");
