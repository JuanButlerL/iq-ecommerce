-- Banners: imagen completa (sin recorte) con un botón configurable encima (color, posición y tamaño; aparte para celular).
ALTER TABLE "home_slides" ADD COLUMN "fit_image" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "overlay_button" JSONB;
