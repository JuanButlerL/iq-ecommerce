-- Días hábiles de viaje de Andreani/Correo por región (la API no los devuelve). Se usan para la fecha de llegada que ve el cliente.
ALTER TABLE "shipping_settings"
  ADD COLUMN "transit_days_amba_min" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "transit_days_amba_max" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "transit_days_bsas_min" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "transit_days_bsas_max" INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN "transit_days_rest_min" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "transit_days_rest_max" INTEGER NOT NULL DEFAULT 6;
