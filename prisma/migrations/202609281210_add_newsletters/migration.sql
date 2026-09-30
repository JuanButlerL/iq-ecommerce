-- Newsletter module. Additive only: new enums, new tables, new indexes and
-- new store_settings columns with safe defaults. No existing row is modified.
-- The section starts hidden and no newsletter is created by this migration.


-- CreateEnum
CREATE TYPE "NewsletterStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED', 'SENT', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "NewsletterDeliveryStatus" AS ENUM ('PENDING', 'RESERVED', 'SENT', 'SKIPPED', 'ERROR');

-- AlterTable
ALTER TABLE "store_settings" ADD COLUMN     "newsletter_daily_limit" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "newsletter_description" TEXT,
ADD COLUMN     "newsletter_eyebrow" TEXT,
ADD COLUMN     "newsletter_from_email" TEXT NOT NULL DEFAULT 'no-reply@iqkids.com.ar',
ADD COLUMN     "newsletter_reply_to_email" TEXT,
ADD COLUMN     "newsletter_section_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "newsletter_sender_name" TEXT NOT NULL DEFAULT 'IQ Kids',
ADD COLUMN     "newsletter_test_recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "newsletter_title" TEXT;

-- CreateTable
CREATE TABLE "newsletters" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "previous_slugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "excerpt" TEXT NOT NULL,
    "cover_image_url" TEXT,
    "cover_image_alt" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "email_subject" TEXT NOT NULL,
    "email_preview_text" TEXT,
    "status" "NewsletterStatus" NOT NULL DEFAULT 'DRAFT',
    "web_visible" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "approved_recipient_count" INTEGER,
    "content_hash" TEXT NOT NULL,
    "last_test_sent_at" TIMESTAMP(3),
    "last_test_content_hash" TEXT,
    "content_locked_at" TIMESTAMP(3),
    "email_snapshot" JSONB,
    "current_wave" INTEGER NOT NULL DEFAULT 0,
    "review_reason" TEXT,
    "sending_started_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_by" TEXT,
    "updated_by" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_deliveries" (
    "id" UUID NOT NULL,
    "newsletter_id" UUID NOT NULL,
    "subscriber_id" UUID,
    "recipient_email" TEXT NOT NULL,
    "wave" INTEGER NOT NULL,
    "status" "NewsletterDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "skip_reason" TEXT,
    "error_message" TEXT,
    "provider_message_id" TEXT,
    "open_token" TEXT NOT NULL,
    "click_token" TEXT NOT NULL,
    "unsubscribe_token" TEXT NOT NULL,
    "open_count" INTEGER NOT NULL DEFAULT 0,
    "first_opened_at" TIMESTAMP(3),
    "last_opened_at" TIMESTAMP(3),
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "first_clicked_at" TIMESTAMP(3),
    "last_clicked_at" TIMESTAMP(3),
    "reserved_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_audit_events" (
    "id" UUID NOT NULL,
    "newsletter_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_email" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletters_slug_key" ON "newsletters"("slug");

-- CreateIndex
CREATE INDEX "newsletters_status_scheduled_idx" ON "newsletters"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "newsletters_web_published_idx" ON "newsletters"("web_visible", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_deliveries_open_token_key" ON "newsletter_deliveries"("open_token");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_deliveries_click_token_key" ON "newsletter_deliveries"("click_token");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_deliveries_unsubscribe_token_key" ON "newsletter_deliveries"("unsubscribe_token");

-- CreateIndex
CREATE INDEX "newsletter_deliveries_newsletter_status_idx" ON "newsletter_deliveries"("newsletter_id", "status");

-- CreateIndex
CREATE INDEX "newsletter_deliveries_status_sent_idx" ON "newsletter_deliveries"("status", "sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_deliveries_newsletter_recipient_key" ON "newsletter_deliveries"("newsletter_id", "recipient_email");

-- CreateIndex
CREATE INDEX "newsletter_audit_events_newsletter_created_idx" ON "newsletter_audit_events"("newsletter_id", "created_at");

-- AddForeignKey
ALTER TABLE "newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_deliveries" ADD CONSTRAINT "newsletter_deliveries_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "newsletter_subscribers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_audit_events" ADD CONSTRAINT "newsletter_audit_events_newsletter_id_fkey" FOREIGN KEY ("newsletter_id") REFERENCES "newsletters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

