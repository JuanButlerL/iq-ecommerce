CREATE TYPE "EmailAutomationTrigger" AS ENUM ('CART_ABANDONED', 'ORDER_CREATED', 'POST_PURCHASE');
CREATE TYPE "EmailSendStatus" AS ENUM ('SENT', 'SKIPPED', 'ERROR');

CREATE TABLE "email_automations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "trigger" "EmailAutomationTrigger" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "delay_hours" INTEGER NOT NULL DEFAULT 24,
  "subject" TEXT NOT NULL,
  "preview_text" TEXT,
  "body_text" TEXT NOT NULL,
  "cta_label" TEXT,
  "cta_url_template" TEXT,
  "sender_name" TEXT NOT NULL DEFAULT 'IQ Kids',
  "from_email" TEXT NOT NULL DEFAULT 'no-reply@iqkids.com.ar',
  "reply_to_email" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_automations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_send_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "automation_id" UUID NOT NULL,
  "trigger" "EmailAutomationTrigger" NOT NULL,
  "status" "EmailSendStatus" NOT NULL,
  "recipient_email" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "order_id" UUID,
  "cart_recovery_lead_id" UUID,
  "provider_message_id" TEXT,
  "error_message" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_send_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_automations_active_trigger_idx" ON "email_automations"("active", "trigger");
CREATE UNIQUE INDEX "email_send_logs_automation_target_key" ON "email_send_logs"("automation_id", "target_type", "target_id");
CREATE INDEX "email_send_logs_recipient_created_idx" ON "email_send_logs"("recipient_email", "created_at");
CREATE INDEX "email_send_logs_status_created_idx" ON "email_send_logs"("status", "created_at");

ALTER TABLE "email_send_logs"
  ADD CONSTRAINT "email_send_logs_automation_id_fkey"
  FOREIGN KEY ("automation_id") REFERENCES "email_automations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "email_automations" (
  "name",
  "trigger",
  "active",
  "delay_hours",
  "subject",
  "preview_text",
  "body_text",
  "cta_label",
  "cta_url_template"
) VALUES
(
  'Carrito abandonado',
  'CART_ABANDONED',
  false,
  3,
  'Tu carrito IQ Kids te está esperando',
  'Podés retomarlo con los mismos productos que elegiste.',
  'Vimos que dejaste algunos productos seleccionados. Si querés seguir, tu carrito queda listo para retomar en un click.',
  'Volver al carrito',
  '{{recoveryUrl}}'
),
(
  'Pedido recibido',
  'ORDER_CREATED',
  false,
  0,
  'Recibimos tu pedido {{orderNumber}}',
  'Te dejamos el detalle para que tengas todo a mano.',
  'Tu pedido ya quedó registrado. Te vamos a avisar cuando avance el estado del pago o preparación.',
  'Ver pedido',
  '{{orderUrl}}'
),
(
  'Recompra 15 días',
  'POST_PURCHASE',
  false,
  360,
  '¿Reponemos snacks para la semana?',
  'Una compra simple para volver a resolver la vianda.',
  'Pasaron unos días desde tu compra. Si querés reponer, podés volver a elegir tus barritas en la tienda.',
  'Comprar otra vez',
  '{{siteUrl}}/#productos'
);
