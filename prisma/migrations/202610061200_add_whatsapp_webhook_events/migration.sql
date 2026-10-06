CREATE TYPE "WhatsappWebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

CREATE TABLE IF NOT EXISTS "whatsapp_webhook_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "dedupe_key" TEXT NOT NULL,
  "object" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "waba_id" TEXT,
  "phone_number_id" TEXT,
  "processing_status" "WhatsappWebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  "processed_at" TIMESTAMP(3),
  "error_message" TEXT,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "whatsapp_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_webhook_events_dedupe_key_key" ON "whatsapp_webhook_events"("dedupe_key");
CREATE INDEX IF NOT EXISTS "whatsapp_webhook_events_field_idx" ON "whatsapp_webhook_events"("field", "created_at");
CREATE INDEX IF NOT EXISTS "whatsapp_webhook_events_phone_idx" ON "whatsapp_webhook_events"("phone_number_id", "created_at");
