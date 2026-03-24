ALTER TABLE "payment_proofs"
ADD COLUMN "transfer_sender_name" TEXT,
ADD COLUMN "transfer_date" TIMESTAMP(3),
ADD COLUMN "transfer_reference" TEXT,
ADD COLUMN "customer_note" TEXT;
