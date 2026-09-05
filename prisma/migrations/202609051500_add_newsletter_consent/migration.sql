-- Additive consent registry. Historical contacts are intentionally not subscribed.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "newsletter_opt_in" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "newsletter_opt_in_at" TIMESTAMP(3);

DO $$ BEGIN
  CREATE TYPE "NewsletterSubscriberStatus" AS ENUM ('SUBSCRIBED', 'UNSUBSCRIBED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "NewsletterConsentSource" AS ENUM ('CHECKOUT', 'WELCOME_POPUP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "status" "NewsletterSubscriberStatus" NOT NULL DEFAULT 'SUBSCRIBED',
  "consent_source" "NewsletterConsentSource" NOT NULL,
  "consent_version" TEXT NOT NULL,
  "consented_at" TIMESTAMP(3) NOT NULL,
  "unsubscribed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");
CREATE INDEX IF NOT EXISTS "newsletter_subscribers_status_consented_idx" ON "newsletter_subscribers"("status", "consented_at");
