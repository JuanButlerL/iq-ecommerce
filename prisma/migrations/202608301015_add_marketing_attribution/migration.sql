DO $$ BEGIN
  CREATE TYPE "MarketingSourceCategory" AS ENUM ('DIRECT', 'ORGANIC', 'META', 'GOOGLE', 'TIKTOK', 'EMAIL', 'WHATSAPP', 'REFERRAL', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MarketingSourcePlatform" AS ENUM ('DIRECT', 'INSTAGRAM', 'FACEBOOK', 'THREADS', 'GOOGLE', 'YOUTUBE', 'TIKTOK', 'WHATSAPP', 'EMAIL', 'REFERRAL', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MarketingEventType" AS ENUM ('SESSION_STARTED', 'POPUP_CAPTURED', 'CART_CAPTURED', 'ORDER_CREATED', 'ORDER_CONFIRMED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "marketing_sessions" (
  "id" UUID NOT NULL,
  "visitor_id" TEXT NOT NULL,
  "session_key" TEXT NOT NULL,
  "entry_path" TEXT NOT NULL,
  "entry_url" TEXT,
  "referrer_url" TEXT,
  "referrer_host" TEXT,
  "source_category" "MarketingSourceCategory" NOT NULL DEFAULT 'DIRECT',
  "source_platform" "MarketingSourcePlatform" NOT NULL DEFAULT 'DIRECT',
  "source_channel" TEXT NOT NULL DEFAULT 'Direct',
  "source_label" TEXT NOT NULL DEFAULT 'Direct',
  "is_paid" BOOLEAN NOT NULL DEFAULT false,
  "utm_source" TEXT,
  "utm_medium" TEXT,
  "utm_campaign" TEXT,
  "utm_content" TEXT,
  "utm_term" TEXT,
  "gclid" TEXT,
  "fbclid" TEXT,
  "ttclid" TEXT,
  "msclkid" TEXT,
  "landing_query" JSONB,
  "email" TEXT,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketing_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketing_sessions_session_key_key" ON "marketing_sessions"("session_key");
CREATE INDEX IF NOT EXISTS "marketing_sessions_email_first_seen_idx" ON "marketing_sessions"("email", "first_seen_at");
CREATE INDEX IF NOT EXISTS "marketing_sessions_source_idx" ON "marketing_sessions"("source_category", "source_platform", "first_seen_at");
CREATE INDEX IF NOT EXISTS "marketing_sessions_campaign_idx" ON "marketing_sessions"("utm_campaign");
CREATE INDEX IF NOT EXISTS "marketing_sessions_visitor_idx" ON "marketing_sessions"("visitor_id", "first_seen_at");

CREATE TABLE IF NOT EXISTS "marketing_events" (
  "id" UUID NOT NULL,
  "marketing_session_id" UUID NOT NULL,
  "event_type" "MarketingEventType" NOT NULL,
  "path" TEXT NOT NULL,
  "email" TEXT,
  "cart_recovery_lead_id" UUID,
  "order_id" UUID,
  "metadata" JSONB,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketing_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "marketing_events_session_occurred_idx" ON "marketing_events"("marketing_session_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "marketing_events_type_occurred_idx" ON "marketing_events"("event_type", "occurred_at");
CREATE INDEX IF NOT EXISTS "marketing_events_email_occurred_idx" ON "marketing_events"("email", "occurred_at");
CREATE INDEX IF NOT EXISTS "marketing_events_order_idx" ON "marketing_events"("order_id");
CREATE INDEX IF NOT EXISTS "marketing_events_lead_idx" ON "marketing_events"("cart_recovery_lead_id");

ALTER TABLE "cart_recovery_leads"
  ADD COLUMN IF NOT EXISTS "marketing_session_id" UUID,
  ADD COLUMN IF NOT EXISTS "marketing_visitor_id" TEXT;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "marketing_session_id" UUID,
  ADD COLUMN IF NOT EXISTS "marketing_visitor_id" TEXT;

CREATE INDEX IF NOT EXISTS "cart_recovery_leads_marketing_session_idx" ON "cart_recovery_leads"("marketing_session_id");
CREATE INDEX IF NOT EXISTS "cart_recovery_leads_marketing_visitor_idx" ON "cart_recovery_leads"("marketing_visitor_id");
CREATE INDEX IF NOT EXISTS "orders_marketing_session_idx" ON "orders"("marketing_session_id");
CREATE INDEX IF NOT EXISTS "orders_marketing_visitor_idx" ON "orders"("marketing_visitor_id");

DO $$ BEGIN
  ALTER TABLE "marketing_events"
    ADD CONSTRAINT "marketing_events_marketing_session_id_fkey"
    FOREIGN KEY ("marketing_session_id") REFERENCES "marketing_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketing_events"
    ADD CONSTRAINT "marketing_events_cart_recovery_lead_id_fkey"
    FOREIGN KEY ("cart_recovery_lead_id") REFERENCES "cart_recovery_leads"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "marketing_events"
    ADD CONSTRAINT "marketing_events_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "cart_recovery_leads"
    ADD CONSTRAINT "cart_recovery_leads_marketing_session_id_fkey"
    FOREIGN KEY ("marketing_session_id") REFERENCES "marketing_sessions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "orders"
    ADD CONSTRAINT "orders_marketing_session_id_fkey"
    FOREIGN KEY ("marketing_session_id") REFERENCES "marketing_sessions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
