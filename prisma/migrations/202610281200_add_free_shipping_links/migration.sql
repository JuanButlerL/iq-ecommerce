-- Personal, single-use free shipping links generated from the admin.
CREATE TABLE IF NOT EXISTS "free_shipping_links" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "token" UUID NOT NULL,
  "note" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_by" TEXT,
  "revoked_at" TIMESTAMP(3),
  "redeemed_at" TIMESTAMP(3),
  "order_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "free_shipping_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "free_shipping_links_token_key" ON "free_shipping_links"("token");
CREATE INDEX IF NOT EXISTS "free_shipping_links_email_idx" ON "free_shipping_links"("email");
CREATE INDEX IF NOT EXISTS "free_shipping_links_created_at_idx" ON "free_shipping_links"("created_at");

ALTER TABLE "free_shipping_links"
  ADD CONSTRAINT "free_shipping_links_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
