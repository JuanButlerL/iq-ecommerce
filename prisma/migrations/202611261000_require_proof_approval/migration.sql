-- Apagado (por defecto): la etiqueta sale apenas el cliente sube el comprobante. Prendido: espera la aprobación en Comprobantes.
ALTER TABLE "shipping_settings" ADD COLUMN "require_proof_approval" BOOLEAN NOT NULL DEFAULT false;
