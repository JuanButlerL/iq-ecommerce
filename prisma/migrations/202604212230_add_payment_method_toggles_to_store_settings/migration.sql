ALTER TABLE "store_settings"
ADD COLUMN IF NOT EXISTS "enable_bank_transfer" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "enable_mercado_pago" BOOLEAN NOT NULL DEFAULT true;
