-- Turn the original home hero into a regular, editable carousel slide.
-- Its CTA keeps the values configured in store settings, with the same
-- fallbacks the home used: the default label and the product of slot 1.
-- It goes before any existing slide and is only created once.
INSERT INTO "home_slides" (
    "id",
    "eyebrow",
    "title",
    "mobile_title",
    "subtitle",
    "badges",
    "cta_label",
    "cta_url",
    "image_url",
    "mobile_image_url",
    "image_alt",
    "active",
    "sort_order",
    "created_at",
    "updated_at"
)
SELECT
    gen_random_uuid(),
    'Snacks para niños',
    'Entre mochilas, corridas y tuppers… por lo menos que el snack ya esté resuelto.',
    'El snack ya está resuelto.',
    'Nutricionistas eligieron cada producto para que vos no tengas que leer etiquetas ni dudar.',
    ARRAY['Nutricionistas', 'Sin sellos', 'Ingredientes reales']::TEXT[],
    COALESCE(
        NULLIF(BTRIM((SELECT "hero_cta_label" FROM "store_settings" WHERE "id" = 'default')), ''),
        'Empezá con la caja mix → 3 sabores, 12 barritas'
    ),
    COALESCE(
        NULLIF(BTRIM((SELECT "hero_cta_url" FROM "store_settings" WHERE "id" = 'default')), ''),
        (
            SELECT '/productos/' || p."slug"
            FROM "home_featured_product_slots" s
            JOIN "products" p ON p."id" = s."product_id"
            WHERE s."slot_order" = 1
        ),
        (
            SELECT '/productos/' || p."slug"
            FROM "products" p
            WHERE p."active" AND p."visible"
            ORDER BY p."sort_order", p."created_at"
            LIMIT 1
        ),
        '/productos'
    ),
    '/redesign/hero-home.jpg',
    NULL,
    COALESCE((SELECT "store_name" FROM "store_settings" WHERE "id" = 'default'), 'IQ Kids'),
    true,
    LEAST(COALESCE((SELECT MIN("sort_order") FROM "home_slides"), 1) - 1, 0),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "home_slides" WHERE "image_url" = '/redesign/hero-home.jpg'
);
