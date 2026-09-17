ALTER TABLE "email_automations"
  ADD COLUMN "cart_recovery_free_shipping_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cart_recovery_free_shipping_message" TEXT;
