-- Selector de precio de Andreani / Correo: tabla por provincia (por defecto) o tarifa real.
ALTER TABLE "shipping_settings" ADD COLUMN "carrier_pricing" TEXT NOT NULL DEFAULT 'TABLE';
