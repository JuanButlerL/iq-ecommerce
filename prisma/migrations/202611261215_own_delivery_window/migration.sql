-- Franja horaria del reparto propio que ve el cliente ("entre las 14 y las 17 h"). Vacío = sin franja.
ALTER TABLE "shipping_settings" ADD COLUMN "own_delivery_window" TEXT NOT NULL DEFAULT 'entre las 14 y las 17 h';
