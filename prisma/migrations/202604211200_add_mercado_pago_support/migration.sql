ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MERCADO_PAGO';

DO $$
BEGIN
    CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL_TRANSFER', 'MERCADO_PAGO');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "PaymentWebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "checkout_request_key" TEXT,
ADD COLUMN IF NOT EXISTS "payment_provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL_TRANSFER',
ADD COLUMN IF NOT EXISTS "payment_provider_reference" TEXT,
ADD COLUMN IF NOT EXISTS "payment_provider_status" TEXT,
ADD COLUMN IF NOT EXISTS "payment_provider_status_detail" TEXT,
ADD COLUMN IF NOT EXISTS "payment_initiated_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "orders_checkout_request_key_key" ON "orders"("checkout_request_key");
CREATE INDEX IF NOT EXISTS "orders_payment_method_status_idx" ON "orders"("payment_method", "payment_status");

CREATE TABLE IF NOT EXISTS "mercado_pago_preferences" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "preference_id" TEXT NOT NULL,
    "external_reference" TEXT NOT NULL,
    "init_point" TEXT NOT NULL,
    "sandbox_init_point" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercado_pago_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mercado_pago_preferences_order_id_key" ON "mercado_pago_preferences"("order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "mercado_pago_preferences_preference_id_key" ON "mercado_pago_preferences"("preference_id");
CREATE UNIQUE INDEX IF NOT EXISTS "mercado_pago_preferences_external_reference_key" ON "mercado_pago_preferences"("external_reference");
CREATE INDEX IF NOT EXISTS "mercado_pago_preferences_order_idx" ON "mercado_pago_preferences"("order_id");

CREATE TABLE IF NOT EXISTS "mercado_pago_payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "mercado_pago_payment_id" TEXT NOT NULL,
    "merchant_order_id" TEXT,
    "preference_id" TEXT,
    "external_reference" TEXT,
    "live_mode" BOOLEAN,
    "status" TEXT NOT NULL,
    "status_detail" TEXT,
    "transaction_amount" INTEGER,
    "currency_id" TEXT,
    "payer_email" TEXT,
    "date_created" TIMESTAMP(3),
    "date_approved" TIMESTAMP(3),
    "date_last_updated" TIMESTAMP(3),
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercado_pago_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mercado_pago_payments_mercado_pago_payment_id_key" ON "mercado_pago_payments"("mercado_pago_payment_id");
CREATE INDEX IF NOT EXISTS "mercado_pago_payments_order_idx" ON "mercado_pago_payments"("order_id", "created_at");
CREATE INDEX IF NOT EXISTS "mercado_pago_payments_preference_idx" ON "mercado_pago_payments"("preference_id");

CREATE TABLE IF NOT EXISTS "payment_webhook_events" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "provider" "PaymentProvider" NOT NULL,
    "webhook_event_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "action" TEXT,
    "resource_id" TEXT,
    "request_id" TEXT,
    "signature_ts" TEXT,
    "signature_v1" TEXT,
    "processing_status" "PaymentWebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "processed_at" TIMESTAMP(3),
    "payment_reference" TEXT,
    "error_message" TEXT,
    "query_params" JSONB,
    "headers" JSONB,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_webhook_events_webhook_event_id_key" ON "payment_webhook_events"("webhook_event_id");
CREATE INDEX IF NOT EXISTS "payment_webhook_events_order_idx" ON "payment_webhook_events"("order_id", "created_at");
CREATE INDEX IF NOT EXISTS "payment_webhook_events_resource_idx" ON "payment_webhook_events"("provider", "resource_id");

ALTER TABLE "mercado_pago_preferences"
ADD CONSTRAINT "mercado_pago_preferences_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mercado_pago_payments"
ADD CONSTRAINT "mercado_pago_payments_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_webhook_events"
ADD CONSTRAINT "payment_webhook_events_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
