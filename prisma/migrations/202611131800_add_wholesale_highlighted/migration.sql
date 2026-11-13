-- "Más elegido" pasa a elegirse desde el admin: un tilde por producto mayorista (uno solo o ninguno).
-- Solo agrega una columna. Para que la página se vea igual que hoy, se marca el producto que hoy
-- lleva la etiqueta con la regla automática anterior.
ALTER TABLE "wholesale_products" ADD COLUMN "highlighted" BOOLEAN NOT NULL DEFAULT false;

WITH visible AS (
  SELECT w."id", w."product_id", w."name", w."sort_order", w."created_at"
  FROM "wholesale_products" w
  WHERE w."active" = true
    AND w."product_id" IS NOT NULL
    AND EXISTS (SELECT 1 FROM "wholesale_product_components" c WHERE c."wholesale_product_id" = w."id")
),
current_pick AS (
  SELECT "id" FROM (
    -- 1) El vinculado al primer producto de la home minorista.
    SELECT v."id", 1 AS rule, v."sort_order", v."created_at"
    FROM visible v
    JOIN "home_featured_product_slots" s ON s."product_id" = v."product_id" AND s."slot_order" = 1
    UNION ALL
    -- 2) Si no, el primero con "mix" en el nombre.
    SELECT v."id", 2 AS rule, v."sort_order", v."created_at"
    FROM visible v
    WHERE lower(v."name") LIKE '%mix%'
  ) candidates
  ORDER BY rule, "sort_order", "created_at"
  LIMIT 1
)
UPDATE "wholesale_products" SET "highlighted" = true WHERE "id" IN (SELECT "id" FROM current_pick);
