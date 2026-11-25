-- Descuento del contrato de Andreani que la API no aplica.
ALTER TABLE "shipping_settings" ADD COLUMN "andreani_discount_pct" INTEGER NOT NULL DEFAULT 0;
