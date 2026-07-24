ALTER TABLE "email_automations"
  ADD COLUMN IF NOT EXISTS "coupon_id" UUID,
  ADD COLUMN IF NOT EXISTS "coupon_headline" TEXT,
  ADD COLUMN IF NOT EXISTS "coupon_message" TEXT;

ALTER TABLE "email_send_logs"
  ADD COLUMN IF NOT EXISTS "cta_url" TEXT,
  ADD COLUMN IF NOT EXISTS "click_token" TEXT,
  ADD COLUMN IF NOT EXISTS "click_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "first_clicked_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_clicked_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "converted_order_id" UUID,
  ADD COLUMN IF NOT EXISTS "converted_order_number" TEXT,
  ADD COLUMN IF NOT EXISTS "converted_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "email_send_logs_click_token_key" ON "email_send_logs"("click_token");
CREATE INDEX IF NOT EXISTS "email_automations_coupon_idx" ON "email_automations"("coupon_id");
CREATE INDEX IF NOT EXISTS "email_send_logs_converted_at_idx" ON "email_send_logs"("converted_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_automations_coupon_id_fkey'
  ) THEN
    ALTER TABLE "email_automations"
      ADD CONSTRAINT "email_automations_coupon_id_fkey"
      FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_send_logs_converted_order_id_fkey'
  ) THEN
    ALTER TABLE "email_send_logs"
      ADD CONSTRAINT "email_send_logs_converted_order_id_fkey"
      FOREIGN KEY ("converted_order_id") REFERENCES "orders"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "short_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL,
  "target_url" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "click_count" INTEGER NOT NULL DEFAULT 0,
  "last_clicked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "short_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "short_links_slug_key" ON "short_links"("slug");
CREATE INDEX IF NOT EXISTS "short_links_active_slug_idx" ON "short_links"("active", "slug");
