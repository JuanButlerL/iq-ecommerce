import { routeError, routeOk } from "@/lib/http/route";
import { syncMercadoPagoPaymentByPaymentId } from "@/features/orders/services/order-service";

type MercadoPagoWebhookPayload = {
  action?: string;
  data?: {
    id?: string | number;
  };
  type?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as MercadoPagoWebhookPayload;
    const { searchParams } = new URL(request.url);

    const topic = payload.type || searchParams.get("topic") || searchParams.get("type");
    const dataId = payload.data?.id || searchParams.get("data.id") || searchParams.get("id");

    if (topic && topic !== "payment") {
      return routeOk({ ignored: true });
    }

    if (!dataId) {
      return routeOk({ ignored: true });
    }

    await syncMercadoPagoPaymentByPaymentId(dataId);

    return routeOk({ received: true });
  } catch (error) {
    return routeError(error);
  }
}
