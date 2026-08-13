DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CouponDiscountType') THEN
    CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
  END IF;
END $$;

ALTER TABLE "coupons"
  ADD COLUMN IF NOT EXISTS "discount_type" "CouponDiscountType" NOT NULL DEFAULT 'PERCENTAGE',
  ADD COLUMN IF NOT EXISTS "fixed_discount_ars" INTEGER;

