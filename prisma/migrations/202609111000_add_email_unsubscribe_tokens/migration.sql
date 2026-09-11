ALTER TABLE "email_send_logs"
  ADD COLUMN "unsubscribe_token" TEXT;

CREATE UNIQUE INDEX "email_send_logs_unsubscribe_token_key"
  ON "email_send_logs"("unsubscribe_token");
