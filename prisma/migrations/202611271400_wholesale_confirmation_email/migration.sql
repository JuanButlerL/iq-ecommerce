-- Mail "Recibimos tu pedido mayorista": se guarda al crear el pedido y sale recién con el pago o el comprobante.
ALTER TABLE "orders" ADD COLUMN "wholesale_email_payload" JSONB, ADD COLUMN "customer_confirmation_sent_at" TIMESTAMP(3);
