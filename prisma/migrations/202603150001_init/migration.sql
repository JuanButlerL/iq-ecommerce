-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "ProductColorTheme" AS ENUM ('CACAO', 'BANANA', 'PEANUT');

-- CreateEnum
CREATE TYPE "ShippingMode" AS ENUM ('FLAT', 'PROVINCE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROOF_UPLOADED', 'PAID', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PROOF_UPLOADED', 'PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncProvider" AS ENUM ('MOCK', 'GOOGLE_SHEETS', 'APPS_SCRIPT');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncLogStatus" AS ENUM ('SUCCESS', 'ERROR');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('WEB');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "supabase_user_id" UUID,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'OPERATIONS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "long_description" TEXT NOT NULL,
    "price_ars" INTEGER NOT NULL,
    "color_theme" "ProductColorTheme" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "manual_sold_out" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "alt_text" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_rules" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mode" "ShippingMode" NOT NULL,
    "flat_price" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_rule_provinces" (
    "id" UUID NOT NULL,
    "shipping_rule_id" UUID NOT NULL,
    "province_code" TEXT NOT NULL,
    "province_name" TEXT NOT NULL,
    "shipping_price" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_rule_provinces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "store_name" TEXT NOT NULL,
    "store_currency" TEXT NOT NULL DEFAULT 'ARS',
    "whatsapp_number" TEXT NOT NULL,
    "instagram_url" TEXT,
    "contact_email" TEXT NOT NULL,
    "bank_alias" TEXT NOT NULL,
    "bank_cbu" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "bank_holder" TEXT NOT NULL,
    "bank_tax_id" TEXT NOT NULL,
    "minimum_order_amount" INTEGER NOT NULL,
    "free_shipping_threshold" INTEGER NOT NULL,
    "flat_shipping_price" INTEGER NOT NULL DEFAULT 0,
    "shipping_mode" "ShippingMode" NOT NULL DEFAULT 'FLAT',
    "active_shipping_rule_id" UUID,
    "checkout_message" TEXT,
    "transfer_instructions" TEXT,
    "order_reservation_hours" INTEGER,
    "institutional_banner" TEXT,
    "purchase_success_message" TEXT,
    "require_tax_id" BOOLEAN NOT NULL DEFAULT false,
    "show_floating_whatsapp" BOOLEAN NOT NULL DEFAULT true,
    "is_store_open" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "public_order_number" TEXT NOT NULL,
    "customer_first_name" TEXT NOT NULL,
    "customer_last_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "customer_tax_id" TEXT,
    "province" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "address_line" TEXT NOT NULL,
    "address_extra" TEXT,
    "notes" TEXT,
    "subtotal_ars" INTEGER NOT NULL,
    "shipping_ars" INTEGER NOT NULL,
    "total_ars" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "order_status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "sync_last_error" TEXT,
    "synced_at" TIMESTAMP(3),
    "source" "OrderSource" NOT NULL DEFAULT 'WEB',
    "reservation_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID,
    "product_name_snapshot" TEXT NOT NULL,
    "unit_price_ars" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total_ars" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "changed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_proofs" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "public_url" TEXT,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" "SyncProvider" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "last_error" TEXT,
    "payload_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" UUID NOT NULL,
    "sync_job_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "status" "SyncLogStatus" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_supabase_user_id_key" ON "admin_users"("supabase_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_visibility_idx" ON "products"("active", "visible", "featured");

-- CreateIndex
CREATE INDEX "products_sort_idx" ON "products"("sort_order");

-- CreateIndex
CREATE INDEX "product_images_sort_idx" ON "product_images"("product_id", "sort_order");

-- CreateIndex
CREATE INDEX "shipping_rule_province_idx" ON "shipping_rule_provinces"("province_code");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_rule_province_code_key" ON "shipping_rule_provinces"("shipping_rule_id", "province_code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_public_order_number_key" ON "orders"("public_order_number");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("order_status", "payment_status");

-- CreateIndex
CREATE INDEX "orders_sync_status_idx" ON "orders"("sync_status");

-- CreateIndex
CREATE INDEX "order_items_order_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_idx" ON "order_status_history"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_proofs_order_idx" ON "payment_proofs"("order_id", "uploaded_at");

-- CreateIndex
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs"("status", "next_retry_at");

-- CreateIndex
CREATE INDEX "sync_logs_job_idx" ON "sync_logs"("sync_job_id", "attempt_number");

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_rule_provinces" ADD CONSTRAINT "shipping_rule_provinces_shipping_rule_id_fkey" FOREIGN KEY ("shipping_rule_id") REFERENCES "shipping_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_settings" ADD CONSTRAINT "store_settings_active_shipping_rule_id_fkey" FOREIGN KEY ("active_shipping_rule_id") REFERENCES "shipping_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_proofs" ADD CONSTRAINT "payment_proofs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_sync_job_id_fkey" FOREIGN KEY ("sync_job_id") REFERENCES "sync_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

