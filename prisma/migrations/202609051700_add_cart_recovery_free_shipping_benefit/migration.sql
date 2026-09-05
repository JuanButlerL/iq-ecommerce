ALTER TABLE "cart_recovery_leads"
  ADD COLUMN "free_shipping_token" TEXT,
  ADD COLUMN "free_shipping_granted_at" TIMESTAMP(3),
  ADD COLUMN "free_shipping_expires_at" TIMESTAMP(3),
  ADD COLUMN "free_shipping_redeemed_at" TIMESTAMP(3),
  ADD COLUMN "free_shipping_order_id" UUID;

CREATE UNIQUE INDEX "cart_recovery_leads_free_shipping_token_key" ON "cart_recovery_leads"("free_shipping_token");
