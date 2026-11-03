CREATE TABLE "home_slides" (
    "id" UUID NOT NULL,
    "eyebrow" TEXT,
    "title" TEXT NOT NULL,
    "mobile_title" TEXT,
    "subtitle" TEXT,
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cta_label" TEXT,
    "cta_url" TEXT,
    "image_url" TEXT NOT NULL,
    "mobile_image_url" TEXT,
    "image_alt" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_slides_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "home_slides_active_sort_idx" ON "home_slides"("active", "sort_order");
