ALTER TABLE "email_automations"
  ADD COLUMN "activated_at" TIMESTAMP(3);

-- Existing active automations must not resume historical backlogs after this release.
UPDATE "email_automations"
SET "activated_at" = CURRENT_TIMESTAMP
WHERE "active" = true
  AND "activated_at" IS NULL;
