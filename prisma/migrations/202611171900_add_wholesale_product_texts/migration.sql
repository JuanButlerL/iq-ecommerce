-- Textos editables de la tarjeta y la ficha de cada producto mayorista. Solo agrega columnas.
-- Vacías = el texto automático de siempre, así que la página se ve igual hasta que se carguen.
ALTER TABLE "wholesale_products" ADD COLUMN "label" TEXT NOT NULL DEFAULT '';
ALTER TABLE "wholesale_products" ADD COLUMN "subtitle" TEXT NOT NULL DEFAULT '';
ALTER TABLE "wholesale_products" ADD COLUMN "price_note" TEXT NOT NULL DEFAULT '';
ALTER TABLE "wholesale_products" ADD COLUMN "button_label" TEXT NOT NULL DEFAULT '';
ALTER TABLE "wholesale_products" ADD COLUMN "link_label" TEXT NOT NULL DEFAULT '';
