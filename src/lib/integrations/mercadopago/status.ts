import { OrderStatus, PaymentStatus } from "@prisma/client";

type MercadoPagoState = {
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  paidAt?: Date | null;
};

export function mapMercadoPagoStatusToInternal(status?: string, statusDetail?: string): MercadoPagoState {
  switch (status) {
    case "approved":
    case "authorized":
      return {
        paymentStatus: PaymentStatus.PAID,
        orderStatus: OrderStatus.PAID,
        paidAt: new Date(),
      };
    case "cancelled":
      return {
        paymentStatus: isExpiredStatusDetail(statusDetail) ? PaymentStatus.EXPIRED : PaymentStatus.CANCELLED,
        orderStatus: isExpiredStatusDetail(statusDetail) ? OrderStatus.EXPIRED : OrderStatus.CANCELLED,
        paidAt: null,
      };
    case "rejected":
    case "charged_back":
    case "refunded":
      return {
        paymentStatus: PaymentStatus.CANCELLED,
        orderStatus: OrderStatus.CANCELLED,
        paidAt: null,
      };
    case "in_process":
    case "in_mediation":
    case "pending":
    default:
      return {
        paymentStatus: PaymentStatus.PENDING,
        orderStatus: OrderStatus.PENDING_PAYMENT,
        paidAt: null,
      };
  }
}

export function getMercadoPagoStatusLabel(status?: string, statusDetail?: string) {
  switch (status) {
    case "approved":
    case "authorized":
      return "Pago aprobado";
    case "pending":
      return "Pago pendiente";
    case "in_process":
      return "Pago en proceso";
    case "in_mediation":
      return "Pago en revision";
    case "cancelled":
      return isExpiredStatusDetail(statusDetail) ? "Pago vencido" : "Pago cancelado";
    case "rejected":
      return "Pago rechazado";
    case "charged_back":
      return "Pago desconocido";
    case "refunded":
      return "Pago devuelto";
    default:
      return "Pago pendiente";
  }
}

function isExpiredStatusDetail(statusDetail?: string) {
  return statusDetail === "expired" || statusDetail === "cc_rejected_call_for_authorize";
}
