ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MERCADO_PAGO';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "store_settings"
ADD COLUMN "mercado_pago_checkout_label" TEXT;

ALTER TABLE "orders"
ADD COLUMN "payment_status_detail" TEXT,
ADD COLUMN "payment_provider_ref" TEXT,
ADD COLUMN "payment_preference_id" TEXT,
ADD COLUMN "payment_checkout_url" TEXT,
ADD COLUMN "payment_approved_at" TIMESTAMP(3),
ADD COLUMN "payment_rejected_at" TIMESTAMP(3),
ADD COLUMN "payment_last_checked_at" TIMESTAMP(3);
