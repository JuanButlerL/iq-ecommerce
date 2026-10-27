CREATE TYPE "WhatsappConnectionStatus" AS ENUM ('PENDING', 'CONNECTING', 'CONNECTED', 'FAILED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS "whatsapp_connections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_key" TEXT NOT NULL,
  "status" "WhatsappConnectionStatus" NOT NULL DEFAULT 'PENDING',
  "signup_event" TEXT,
  "encrypted_token" TEXT,
  "token_obtained_at" TIMESTAMP(3),
  "waba_id" TEXT,
  "phone_number_id" TEXT,
  "business_id" TEXT,
  "display_phone_number" TEXT,
  "verified_name" TEXT,
  "is_on_biz_app" BOOLEAN,
  "platform_type" TEXT,
  "contacts_sync_request_id" TEXT,
  "history_sync_request_id" TEXT,
  "last_step" TEXT,
  "error_message" TEXT,
  "steps" JSONB NOT NULL DEFAULT '[]',
  "connected_at" TIMESTAMP(3),
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_connections_session_key_key" ON "whatsapp_connections"("session_key");
CREATE INDEX IF NOT EXISTS "whatsapp_connections_status_idx" ON "whatsapp_connections"("status", "created_at");
