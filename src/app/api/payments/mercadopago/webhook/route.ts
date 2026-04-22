import { routeError, routeOk } from "@/lib/http/route";
import { handleMercadoPagoWebhook } from "@/features/orders/services/mercado-pago-service";

export async function POST(request: Request) {
  try {
    const result = await handleMercadoPagoWebhook(request);
    return routeOk(result);
  } catch (error) {
    return routeError(error);
  }
}
