ALTER TABLE "store_settings"
ADD COLUMN IF NOT EXISTS "enable_bank_transfer_discount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "bank_transfer_discount_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0;

ALTER TABLE "orders"
ADD COLUMN IF NOT EXISTS "payment_method_discount_percentage" DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS "payment_method_discount_ars" INTEGER NOT NULL DEFAULT 0;
