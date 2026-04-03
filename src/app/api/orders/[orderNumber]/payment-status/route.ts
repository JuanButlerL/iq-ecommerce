import { routeError, routeOk } from "@/lib/http/route";
import { syncMercadoPagoPaymentByOrderNumber } from "@/features/orders/services/order-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  try {
    const { orderNumber } = await params;
    const body = (await request.json().catch(() => ({}))) as { paymentId?: string | null };
    const order = await syncMercadoPagoPaymentByOrderNumber(orderNumber, body.paymentId);

    if (!order) {
      throw new Error("Order not found after payment sync.");
    }

    return routeOk({
      orderNumber: order.publicOrderNumber,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      paymentStatusDetail: order.paymentStatusDetail,
      paymentProviderRef: order.paymentProviderRef,
    });
  } catch (error) {
    return routeError(error);
  }
}
