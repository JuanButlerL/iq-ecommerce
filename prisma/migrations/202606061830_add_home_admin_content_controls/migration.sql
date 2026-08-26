ALTER TABLE "products"
ADD COLUMN "visual_accent_hex" TEXT,
ADD COLUMN "visual_surface_hex" TEXT,
ADD COLUMN "visual_text_hex" TEXT;

ALTER TABLE "store_settings"
ADD COLUMN "announcement_bar_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "announcement_bar_text" TEXT;

CREATE TABLE "testimonials" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "role_label" TEXT,
  "quote" TEXT NOT NULL,
  "avatar_label" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "testimonials_active_sort_idx" ON "testimonials"("active", "sort_order");
