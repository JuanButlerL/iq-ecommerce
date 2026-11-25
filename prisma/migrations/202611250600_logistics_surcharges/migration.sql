-- Logística: recargo por llevar los paquetes al transportista y precio de envío fijo por cliente mayorista.
-- Solo agrega columnas con valor por defecto o nullable.
ALTER TABLE "shipping_settings" ADD COLUMN "andreani_surcharge_ars" INTEGER NOT NULL DEFAULT 2500,
ADD COLUMN "correo_surcharge_ars" INTEGER NOT NULL DEFAULT 2500;

ALTER TABLE "wholesale_customers" ADD COLUMN "shipping_price_ars" INTEGER;
