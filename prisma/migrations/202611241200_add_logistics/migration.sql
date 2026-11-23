-- Logística: Andreani, Correo Argentino y reparto propio. Solo agrega tablas, tipos y columnas nullable.

CREATE TYPE "ShippingCarrier" AS ENUM ('OWN', 'ANDREANI', 'CORREO_AR');

CREATE TYPE "ShippingDeliveryType" AS ENUM ('HOME', 'BRANCH');

CREATE TYPE "ShippingPriceSource" AS ENUM ('LIVE', 'CACHED', 'FALLBACK', 'OWN_ZONE', 'LEGACY');

CREATE TYPE "ShipmentStatus" AS ENUM ('WAITING_PAYMENT', 'PENDING', 'PROCESSING', 'CREATED', 'ERROR', 'NEEDS_REVIEW', 'CANCELLED');

CREATE TYPE "PaymentProofReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "orders" ADD COLUMN     "estimated_dispatch_date" DATE,
ADD COLUMN     "shipping_branch_address" TEXT,
ADD COLUMN     "shipping_branch_id" TEXT,
ADD COLUMN     "shipping_branch_name" TEXT,
ADD COLUMN     "shipping_carrier" "ShippingCarrier",
ADD COLUMN     "shipping_carrier_price_ars" INTEGER,
ADD COLUMN     "shipping_delivery_type" "ShippingDeliveryType",
ADD COLUMN     "shipping_price_source" "ShippingPriceSource",
ADD COLUMN     "shipping_zone_name" TEXT;

ALTER TABLE "payment_proofs" ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "review_status" "PaymentProofReviewStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by" TEXT;

ALTER TABLE "products" ADD COLUMN     "height_cm" INTEGER,
ADD COLUMN     "length_cm" INTEGER,
ADD COLUMN     "weight_grams" INTEGER,
ADD COLUMN     "width_cm" INTEGER;

ALTER TABLE "wholesale_customers" ADD COLUMN     "preferred_carrier" "ShippingCarrier";

ALTER TABLE "wholesale_products" ADD COLUMN     "height_cm" INTEGER,
ADD COLUMN     "length_cm" INTEGER,
ADD COLUMN     "weight_grams" INTEGER,
ADD COLUMN     "width_cm" INTEGER;

CREATE TABLE "shipping_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "andreani_enabled" BOOLEAN NOT NULL DEFAULT false,
    "correo_enabled" BOOLEAN NOT NULL DEFAULT false,
    "own_enabled" BOOLEAN NOT NULL DEFAULT true,
    "branch_pickup_enabled" BOOLEAN NOT NULL DEFAULT true,
    "cutoff_hour" INTEGER NOT NULL DEFAULT 13,
    "cutoff_minute" INTEGER NOT NULL DEFAULT 0,
    "preparation_business_days" INTEGER NOT NULL DEFAULT 0,
    "default_unit_weight_grams" INTEGER NOT NULL DEFAULT 400,
    "default_unit_length_cm" INTEGER NOT NULL DEFAULT 20,
    "default_unit_width_cm" INTEGER NOT NULL DEFAULT 15,
    "default_unit_height_cm" INTEGER NOT NULL DEFAULT 10,
    "quote_cache_hours" INTEGER NOT NULL DEFAULT 24,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "own_delivery_zones" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_ars" INTEGER NOT NULL,
    "wholesale_price_ars" INTEGER,
    "delivery_days_min" INTEGER NOT NULL DEFAULT 1,
    "delivery_days_max" INTEGER NOT NULL DEFAULT 2,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "own_delivery_zones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "postal_codes" (
    "id" UUID NOT NULL,
    "postal_code" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "own_zone_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "postal_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipping_holidays" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_holidays_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tax_id" TEXT,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" TEXT,
    "locality" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipping_quote_cache" (
    "id" UUID NOT NULL,
    "cache_key" TEXT NOT NULL,
    "carrier" "ShippingCarrier" NOT NULL,
    "delivery_type" "ShippingDeliveryType" NOT NULL,
    "postal_code" TEXT NOT NULL,
    "price_ars" INTEGER NOT NULL,
    "delivery_days_min" INTEGER,
    "delivery_days_max" INTEGER,
    "fetched_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_quote_cache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipping_branch_cache" (
    "id" UUID NOT NULL,
    "cache_key" TEXT NOT NULL,
    "carrier" "ShippingCarrier" NOT NULL,
    "branches" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_branch_cache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "carrier" "ShippingCarrier" NOT NULL,
    "delivery_type" "ShippingDeliveryType" NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'WAITING_PAYMENT',
    "tracking_number" TEXT,
    "carrier_shipment_id" TEXT,
    "label_storage_path" TEXT,
    "dispatch_date" DATE,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "locked_until" TIMESTAMP(3),
    "last_error" TEXT,
    "last_request" JSONB,
    "last_response" JSONB,
    "created_manually" BOOLEAN NOT NULL DEFAULT false,
    "customer_notified_at" TIMESTAMP(3),
    "label_created_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipment_events" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "own_delivery_zones_name_key" ON "own_delivery_zones"("name");

CREATE INDEX "postal_codes_cp_idx" ON "postal_codes"("postal_code");

CREATE INDEX "postal_codes_zone_idx" ON "postal_codes"("own_zone_id");

CREATE UNIQUE INDEX "postal_codes_cp_locality_key" ON "postal_codes"("postal_code", "locality");

CREATE UNIQUE INDEX "shipping_holidays_date_key" ON "shipping_holidays"("date");

CREATE UNIQUE INDEX "shipping_quote_cache_cache_key_key" ON "shipping_quote_cache"("cache_key");

CREATE INDEX "shipping_quote_cache_carrier_cp_idx" ON "shipping_quote_cache"("carrier", "postal_code");

CREATE UNIQUE INDEX "shipping_branch_cache_cache_key_key" ON "shipping_branch_cache"("cache_key");

CREATE UNIQUE INDEX "shipments_order_id_key" ON "shipments"("order_id");

CREATE INDEX "shipments_status_next_idx" ON "shipments"("status", "next_attempt_at");

CREATE INDEX "shipment_events_shipment_idx" ON "shipment_events"("shipment_id", "created_at");

ALTER TABLE "postal_codes" ADD CONSTRAINT "postal_codes_own_zone_id_fkey" FOREIGN KEY ("own_zone_id") REFERENCES "own_delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comprobantes de pedidos que ya están pagos o más adelante: quedan como aprobados.
UPDATE "payment_proofs" SET "review_status" = 'APPROVED', "reviewed_at" = CURRENT_TIMESTAMP, "reviewed_by" = 'migracion'
WHERE "order_id" IN (SELECT "id" FROM "orders" WHERE "order_status" IN ('PAID', 'PREPARING', 'SHIPPED', 'DELIVERED'));

-- Fila de configuración, con la integración apagada.
INSERT INTO "shipping_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
