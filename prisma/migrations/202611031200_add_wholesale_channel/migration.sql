-- Canal mayorista: maestro de clientes, productos con precio propio, condiciones y tabla de envíos aparte.
CREATE TYPE "SalesChannel" AS ENUM ('RETAIL', 'WHOLESALE');
CREATE TYPE "TaxCondition" AS ENUM ('RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO', 'CONSUMIDOR_FINAL');

ALTER TABLE "shipping_rules" ADD COLUMN "channel" "SalesChannel" NOT NULL DEFAULT 'RETAIL';

CREATE TABLE "wholesale_customers" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "business_name" TEXT,
    "legal_name" TEXT,
    "business_type" TEXT,
    "cuit" TEXT NOT NULL,
    "tax_condition" "TaxCondition",
    "street" TEXT NOT NULL,
    "floor" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "reference" TEXT,
    "allow_deferred_payment" BOOLEAN NOT NULL DEFAULT false,
    "extra_discount_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "admin_notes" TEXT,
    "lead_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_customers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wholesale_customers_cuit_key" ON "wholesale_customers"("cuit");
CREATE INDEX "wholesale_customers_email_idx" ON "wholesale_customers"("email");
CREATE INDEX "wholesale_customers_created_idx" ON "wholesale_customers"("created_at");
ALTER TABLE "wholesale_customers" ADD CONSTRAINT "wholesale_customers_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "wholesale_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "wholesale_products" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image_url" TEXT NOT NULL DEFAULT '',
    "image_alt" TEXT NOT NULL DEFAULT '',
    "price_ars" INTEGER NOT NULL,
    "units_per_display" INTEGER NOT NULL DEFAULT 12,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sold_out" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "product_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_products_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wholesale_products_active_sort_idx" ON "wholesale_products"("active", "sort_order");
ALTER TABLE "wholesale_products" ADD CONSTRAINT "wholesale_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "wholesale_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "min_displays" INTEGER NOT NULL DEFAULT 10,
    "enable_mercado_pago" BOOLEAN NOT NULL DEFAULT true,
    "enable_bank_transfer" BOOLEAN NOT NULL DEFAULT true,
    "enable_echeq" BOOLEAN NOT NULL DEFAULT true,
    "echeq_max_days" INTEGER NOT NULL DEFAULT 15,
    "echeq_instructions" TEXT,
    "enable_bank_transfer_discount" BOOLEAN NOT NULL DEFAULT false,
    "bank_transfer_discount_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "free_shipping_threshold_ars" INTEGER,
    "order_notification_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_settings_pkey" PRIMARY KEY ("id")
);

-- Condiciones iniciales: mínimo de 10 displays (1 bulto) y eCheq a 15 días como máximo.
INSERT INTO "wholesale_settings" ("id", "echeq_instructions", "order_notification_emails", "updated_at")
VALUES ('default', 'El eCheq tiene que tener fecha de pago a 15 días como máximo.', ARRAY['nicolas@ikifoods.com.ar'], CURRENT_TIMESTAMP);

-- Tabla de envíos mayorista: arranca como copia de la regla minorista activa (o la más vieja), para editarla después.
WITH source_rule AS (
    SELECT r.*
    FROM "shipping_rules" r
    LEFT JOIN "store_settings" s ON s."active_shipping_rule_id" = r."id"
    ORDER BY (s."id" IS NOT NULL) DESC, r."created_at" ASC
    LIMIT 1
), new_rule AS (
    INSERT INTO "shipping_rules" ("id", "name", "description", "mode", "flat_price", "active", "is_default", "channel", "updated_at")
    SELECT gen_random_uuid(), 'Envíos mayoristas', 'Costo de envío para pedidos de /mayoristas.', COALESCE((SELECT "mode" FROM source_rule), 'PROVINCE'),
           (SELECT "flat_price" FROM source_rule), true, false, 'WHOLESALE', CURRENT_TIMESTAMP
    RETURNING "id"
)
INSERT INTO "shipping_rule_provinces" ("id", "shipping_rule_id", "province_code", "province_name", "shipping_price", "active", "updated_at")
SELECT gen_random_uuid(), new_rule."id", p."province_code", p."province_name", p."shipping_price", p."active", CURRENT_TIMESTAMP
FROM new_rule
JOIN "shipping_rule_provinces" p ON p."shipping_rule_id" = (SELECT "id" FROM source_rule);

-- Productos: se toman de la página mayorista guardada (fotos y textos) con el precio del pedido rápido;
-- si todavía no hay página guardada, se cargan los cuatro displays originales.
INSERT INTO "wholesale_products" ("id", "name", "description", "image_url", "image_alt", "price_ars", "sort_order", "updated_at")
SELECT gen_random_uuid(),
       item.value->>'name',
       COALESCE(item.value->>'description', ''),
       COALESCE(item.value->>'imageUrl', ''),
       COALESCE(item.value->>'imageAlt', ''),
       COALESCE((page."content"->'contact'->'orderItems'->((item.ordinality - 1)::int)->>'price')::int, 16000),
       item.ordinality - 1,
       CURRENT_TIMESTAMP
FROM "wholesale_page" page
CROSS JOIN LATERAL jsonb_array_elements(page."content"::jsonb->'products'->'items') WITH ORDINALITY AS item(value, ordinality)
WHERE page."id" = 'default';

INSERT INTO "wholesale_products" ("id", "name", "description", "image_url", "image_alt", "price_ars", "sort_order", "updated_at")
SELECT gen_random_uuid(), seed.name, seed.description, seed.image_url, seed.image_alt, 16000, seed.sort_order, CURRENT_TIMESTAMP
FROM (VALUES
    ('Maní', '4 ingredientes. Display x12 barritas de 30 g.', '/mayoristas/mani.jpg', 'Display de barritas iQ Kids sabor Maní', 0),
    ('Cacao', '4 ingredientes. Display x12 barritas de 30 g.', '/mayoristas/cacao.jpg', 'Display de barritas iQ Kids sabor Cacao', 1),
    ('Banana', '6 ingredientes. Display x12 barritas de 30 g.', '/mayoristas/banana.jpg', 'Display de barritas iQ Kids sabor Banana', 2),
    ('Caja Mix', '12 barritas con los tres sabores. Ideal para probar.', '/mayoristas/mix.jpg', 'Caja Mix iQ Kids con los tres sabores', 3)
) AS seed(name, description, image_url, image_alt, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM "wholesale_products");
