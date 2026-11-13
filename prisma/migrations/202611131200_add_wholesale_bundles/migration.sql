-- Bultos mayoristas: cada producto mayorista se compone de displays de la tienda.
-- Solo agrega: no borra ni modifica columnas existentes, y todos los productos actuales quedan como
-- "1 display del producto vinculado", que es exactamente como se venden hoy.
CREATE TYPE "WholesaleProductKind" AS ENUM ('FIXED', 'CUSTOM');

ALTER TABLE "wholesale_products"
ADD COLUMN "kind" "WholesaleProductKind" NOT NULL DEFAULT 'FIXED',
ADD COLUMN "box_displays" INTEGER NOT NULL DEFAULT 10;

CREATE TABLE "wholesale_product_components" (
    "id" UUID NOT NULL,
    "wholesale_product_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wholesale_product_components_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wholesale_product_components_product_key" ON "wholesale_product_components"("wholesale_product_id", "product_id");
CREATE INDEX "wholesale_product_components_retail_idx" ON "wholesale_product_components"("product_id");
ALTER TABLE "wholesale_product_components" ADD CONSTRAINT "wholesale_product_components_wholesale_product_id_fkey" FOREIGN KEY ("wholesale_product_id") REFERENCES "wholesale_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wholesale_product_components" ADD CONSTRAINT "wholesale_product_components_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Los productos mayoristas de hoy (uno por display) pasan a tener su composición explícita: 1 display.
INSERT INTO "wholesale_product_components" ("id", "wholesale_product_id", "product_id", "quantity", "sort_order")
SELECT gen_random_uuid(), "id", "product_id", 1, 0
FROM "wholesale_products"
WHERE "product_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Composición congelada de cada ítem de pedido mayorista. Los pedidos anteriores quedan en NULL
-- y se siguen sincronizando como hasta ahora.
ALTER TABLE "order_items" ADD COLUMN "wholesale_components" JSONB;
