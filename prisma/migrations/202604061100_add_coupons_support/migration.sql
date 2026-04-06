CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discount_percentage" DECIMAL(5,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "orders"
ADD COLUMN "coupon_id" UUID,
ADD COLUMN "coupon_code" TEXT,
ADD COLUMN "discount_percentage" DECIMAL(5,2),
ADD COLUMN "discount_ars" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");
CREATE INDEX "coupons_active_code_idx" ON "coupons"("active", "code");
CREATE INDEX "orders_coupon_idx" ON "orders"("coupon_id");

ALTER TABLE "orders"
ADD CONSTRAINT "orders_coupon_id_fkey"
FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
