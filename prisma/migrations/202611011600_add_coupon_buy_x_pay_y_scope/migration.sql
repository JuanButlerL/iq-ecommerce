-- Lets a buy X pay Y coupon count units per product instead of mixing products.
-- Additive only: one column with a default that keeps the current behaviour (mixing products).
ALTER TABLE "coupons"
  ADD COLUMN IF NOT EXISTS "buy_x_pay_y_same_product_only" BOOLEAN NOT NULL DEFAULT false;
