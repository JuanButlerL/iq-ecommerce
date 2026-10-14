ALTER TABLE "products"
ADD COLUMN "discount_percentage" INTEGER,
ADD COLUMN "discount_starts_at" TIMESTAMP(3),
ADD COLUMN "discount_ends_at" TIMESTAMP(3);
