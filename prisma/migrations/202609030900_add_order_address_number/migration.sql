-- Additive fields only: historical address_line values stay intact for existing orders.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "address_number" TEXT,
  ADD COLUMN IF NOT EXISTS "address_without_number" BOOLEAN;
