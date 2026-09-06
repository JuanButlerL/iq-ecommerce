-- Previous versions granted this benefit automatically without mentioning it in the email.
-- Keep redeemed records for audit, but clear only unused offers before the new opt-in setting is available.
UPDATE "cart_recovery_leads"
SET
  "free_shipping_token" = NULL,
  "free_shipping_granted_at" = NULL,
  "free_shipping_expires_at" = NULL,
  "free_shipping_order_id" = NULL
WHERE "free_shipping_redeemed_at" IS NULL
  AND "free_shipping_token" IS NOT NULL;
