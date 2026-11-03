import type { PaymentMethod, SalesChannel } from "@prisma/client";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Transferencia",
  MERCADO_PAGO: "Mercado Pago",
  ECHEQ: "eCheq",
  DEFERRED: "Pago diferido",
};

export const SALES_CHANNEL_LABELS: Record<SalesChannel, string> = {
  RETAIL: "Minorista",
  WHOLESALE: "Mayorista",
};
