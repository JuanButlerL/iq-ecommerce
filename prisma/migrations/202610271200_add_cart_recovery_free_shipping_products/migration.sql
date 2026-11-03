-- Products whose carts can receive the cart-recovery free shipping benefit.
ALTER TABLE "email_automations"
  ADD COLUMN IF NOT EXISTS "cart_recovery_free_shipping_product_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

-- Automations that already offer the benefit keep every active product eligible
-- until the admin narrows the list.
UPDATE "email_automations"
SET "cart_recovery_free_shipping_product_ids" = ARRAY(
  SELECT "id" FROM "products" WHERE "active" = true ORDER BY "sort_order", "created_at"
)
WHERE "cart_recovery_free_shipping_enabled" = true
  AND cardinality("cart_recovery_free_shipping_product_ids") = 0;
