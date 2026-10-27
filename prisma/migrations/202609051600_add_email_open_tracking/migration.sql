ALTER TABLE "email_send_logs"
  ADD COLUMN "open_token" TEXT,
  ADD COLUMN "open_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "first_opened_at" TIMESTAMP(3),
  ADD COLUMN "last_opened_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "email_send_logs_open_token_key" ON "email_send_logs"("open_token");
CREATE INDEX "email_send_logs_first_opened_at_idx" ON "email_send_logs"("first_opened_at");
