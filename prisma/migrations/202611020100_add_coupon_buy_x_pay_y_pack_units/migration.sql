-- Lets a buy X pay Y coupon treat some products as packs of several units (e.g. "3 display").
-- Additive only: one column whose default (empty list) keeps every existing coupon unchanged.
ALTER TABLE "coupons"
  ADD COLUMN IF NOT EXISTS "buy_x_pay_y_pack_units" JSONB NOT NULL DEFAULT '[]';
