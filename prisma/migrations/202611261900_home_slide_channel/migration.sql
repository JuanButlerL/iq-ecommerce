-- El carrusel de /mayoristas pasa a usar la misma tabla y el mismo admin que el de la home de la tienda.
ALTER TABLE "home_slides" ADD COLUMN "channel" "SalesChannel" NOT NULL DEFAULT 'RETAIL';
CREATE INDEX "home_slides_channel_active_sort_idx" ON "home_slides"("channel", "active", "sort_order");

-- Los slides que ya estaban cargados en el JSON de la página mayorista se copian como slides WHOLESALE,
-- en el mismo orden, y se vacían del JSON para que no queden dos copias.
INSERT INTO "home_slides" (
  "id", "eyebrow", "title", "subtitle", "badges", "cta_label", "cta_url", "image_url", "mobile_image_url",
  "image_alt", "image_overlay", "fit_image", "active", "sort_order", "channel", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(),
  NULLIF(slide->>'eyebrow', ''),
  COALESCE(slide->>'title', ''),
  NULLIF(slide->>'description', ''),
  ARRAY[]::TEXT[],
  NULLIF(slide->>'ctaLabel', ''),
  NULLIF(slide->>'ctaUrl', ''),
  slide->>'imageUrl',
  NULLIF(slide->>'mobileImageUrl', ''),
  NULLIF(slide->>'imageAlt', ''),
  COALESCE((slide->>'overlay')::BOOLEAN, true),
  false,
  true,
  position::INT,
  'WHOLESALE',
  NOW(),
  NOW()
FROM "wholesale_page" page,
  jsonb_array_elements(COALESCE(page."content"->'hero'->'slides', '[]'::jsonb)) WITH ORDINALITY AS slides(slide, position)
WHERE page."id" = 'default' AND COALESCE(slide->>'imageUrl', '') <> '';

UPDATE "wholesale_page"
SET "content" = jsonb_set("content", '{hero,slides}', '[]'::jsonb)
WHERE "id" = 'default' AND jsonb_typeof("content"->'hero'->'slides') = 'array';
