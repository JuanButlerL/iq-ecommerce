ALTER TABLE "store_settings"
ADD COLUMN "subscription_section_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "subscription_cta_url" TEXT,
ADD COLUMN "subscription_item_one" TEXT,
ADD COLUMN "subscription_item_two" TEXT,
ADD COLUMN "subscription_item_three" TEXT;
