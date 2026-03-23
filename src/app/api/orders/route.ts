import { checkoutSchema } from "@/lib/validations/checkout";
import { createOrderFromCheckout } from "@/features/orders/services/order-service";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = checkoutSchema.parse(body);
    const order = await createOrderFromCheckout(payload);

    return routeOk({
      orderNumber: order.publicOrderNumber,
    });
  } catch (error) {
    return routeError(error);
  }
}
