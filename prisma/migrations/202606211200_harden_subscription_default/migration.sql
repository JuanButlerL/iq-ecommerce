UPDATE "store_settings"
SET "subscription_section_enabled" = false
WHERE "subscription_section_enabled" = true
  AND "subscription_cta_url" IS NULL
  AND "subscription_hero_note" IS NULL
  AND "subscription_item_one" IS NULL
  AND "subscription_item_two" IS NULL
  AND "subscription_item_three" IS NULL;

ALTER TABLE "store_settings"
ALTER COLUMN "subscription_section_enabled" SET DEFAULT false;
