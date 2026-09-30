-- Newsletter editorial fields. Additive only: three nullable columns, no data changes.
ALTER TABLE "newsletters" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "newsletters" ADD COLUMN IF NOT EXISTS "header_tag" TEXT;
ALTER TABLE "newsletters" ADD COLUMN IF NOT EXISTS "internal_notes" TEXT;
