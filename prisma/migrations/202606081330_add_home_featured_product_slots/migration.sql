CREATE TABLE "home_featured_product_slots" (
    "id" UUID NOT NULL,
    "slot_order" INTEGER NOT NULL,
    "product_id" UUID NOT NULL,
    "eyebrow" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quote" TEXT,
    "button_label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_featured_product_slots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "home_featured_product_slots_slot_order_key" ON "home_featured_product_slots"("slot_order");
CREATE INDEX "home_featured_product_slots_order_idx" ON "home_featured_product_slots"("slot_order");
CREATE INDEX "home_featured_product_slots_product_idx" ON "home_featured_product_slots"("product_id");

ALTER TABLE "home_featured_product_slots"
ADD CONSTRAINT "home_featured_product_slots_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
