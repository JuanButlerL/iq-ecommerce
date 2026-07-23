ALTER TABLE "email_automations"
  ADD COLUMN IF NOT EXISTS "bcc_email" TEXT;
