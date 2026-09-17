ALTER TABLE "store_settings"
ADD COLUMN "faq_section_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "frequently_asked_questions" (
  "id" UUID NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "frequently_asked_questions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "frequently_asked_questions_active_sort_idx"
ON "frequently_asked_questions"("active", "sort_order");
