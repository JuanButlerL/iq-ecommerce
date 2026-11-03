-- Consultas del formulario "Soy nuevo" de /mayoristas.
CREATE TYPE "WholesaleLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CLIENT', 'DISCARDED');

CREATE TABLE "wholesale_leads" (
    "id" UUID NOT NULL,
    "status" "WholesaleLeadStatus" NOT NULL DEFAULT 'NEW',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "business_name" TEXT,
    "business_type" TEXT NOT NULL,
    "cuit" TEXT,
    "street" TEXT NOT NULL,
    "floor" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "reference" TEXT,
    "monthly_volume" TEXT,
    "message" TEXT,
    "admin_notes" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "notified_at" TIMESTAMP(3),
    "notification_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_leads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wholesale_leads_status_created_idx" ON "wholesale_leads"("status", "created_at");
CREATE INDEX "wholesale_leads_ip_created_idx" ON "wholesale_leads"("ip_address", "created_at");
