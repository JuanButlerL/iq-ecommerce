import { PaymentMethod, PaymentStatus } from "@prisma/client";

export function getPaymentMethodLabel(method: PaymentMethod) {
  switch (method) {
    case PaymentMethod.MERCADO_PAGO:
      return "Mercado Pago";
    case PaymentMethod.BANK_TRANSFER:
    default:
      return "Transferencia bancaria";
  }
}

export function getPaymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case PaymentStatus.PAID:
      return "Pagado";
    case PaymentStatus.PROOF_UPLOADED:
      return "Comprobante enviado";
    case PaymentStatus.REJECTED:
      return "Rechazado";
    case PaymentStatus.CANCELLED:
      return "Cancelado";
    case PaymentStatus.EXPIRED:
      return "Vencido";
    case PaymentStatus.PENDING:
    default:
      return "Pendiente";
  }
}
