-- Copia oculta del mail de seguimiento (mails separados por coma), editable en Admin > Logística.
ALTER TABLE "shipping_settings" ADD COLUMN "shipping_email_bcc" TEXT NOT NULL DEFAULT '';
