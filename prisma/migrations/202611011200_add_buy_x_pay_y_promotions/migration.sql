-- Buy X pay Y promotions (2x1, 3x2, ...) for coupons and product discounts.
-- Additive only: adds one enum value, one enum type and nullable/defaulted columns.
-- No existing row is updated or deleted, and every statement is safe to re-run.

ALTER TYPE "CouponDiscountType" ADD VALUE IF NOT EXISTS 'BUY_X_PAY_Y';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductDiscountType') THEN
    CREATE TYPE "ProductDiscountType" AS ENUM ('PERCENTAGE', 'BUY_X_PAY_Y');
  END IF;
END $$;

ALTER TABLE "coupons"
  ADD COLUMN IF NOT EXISTS "buy_quantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "pay_quantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "free_units_count_for_free_shipping" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "discount_type" "ProductDiscountType" NOT NULL DEFAULT 'PERCENTAGE',
  ADD COLUMN IF NOT EXISTS "discount_buy_quantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "discount_pay_quantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "discount_free_units_count_for_free_shipping" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "free_units" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "promo_label" TEXT;
