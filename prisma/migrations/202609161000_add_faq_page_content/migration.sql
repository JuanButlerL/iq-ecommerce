ALTER TABLE "store_settings"
ADD COLUMN IF NOT EXISTS "faq_eyebrow" TEXT,
ADD COLUMN IF NOT EXISTS "faq_title" TEXT,
ADD COLUMN IF NOT EXISTS "faq_title_accent" TEXT,
ADD COLUMN IF NOT EXISTS "faq_description" TEXT,
ADD COLUMN IF NOT EXISTS "faq_support_title" TEXT,
ADD COLUMN IF NOT EXISTS "faq_support_text" TEXT;
