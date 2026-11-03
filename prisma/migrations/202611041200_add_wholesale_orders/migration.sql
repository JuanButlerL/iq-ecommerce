-- Pedidos mayoristas: mismo modelo de pedidos con canal, cliente del maestro y medios de pago propios.
ALTER TYPE "PaymentMethod" ADD VALUE 'ECHEQ';
ALTER TYPE "PaymentMethod" ADD VALUE 'DEFERRED';

ALTER TABLE "orders" ADD COLUMN "channel" "SalesChannel" NOT NULL DEFAULT 'RETAIL',
ADD COLUMN "wholesale_customer_id" UUID,
ADD COLUMN "customer_business_name" TEXT,
ADD COLUMN "customer_tax_condition" "TaxCondition",
ADD COLUMN "extra_discount_percentage" DECIMAL(5,2),
ADD COLUMN "extra_discount_ars" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "delivery_address_changed" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "orders_channel_created_idx" ON "orders"("channel", "created_at");
CREATE INDEX "orders_wholesale_customer_idx" ON "orders"("wholesale_customer_id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_wholesale_customer_id_fkey" FOREIGN KEY ("wholesale_customer_id") REFERENCES "wholesale_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_items" ADD COLUMN "wholesale_product_id" UUID;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_wholesale_product_id_fkey" FOREIGN KEY ("wholesale_product_id") REFERENCES "wholesale_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
