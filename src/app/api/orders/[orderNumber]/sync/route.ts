import { requireAdmin } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { retryOrderSync } from "@/features/orders/services/sync-service";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  try {
    await requireAdmin();
    const { orderNumber } = await params;
    const order = await prisma.order.findUnique({
      where: { publicOrderNumber: orderNumber },
    });

    if (!order) {
      throw new Error("Pedido no encontrado.");
    }

    const result = await retryOrderSync(order.id);

    return routeOk(result);
  } catch (error) {
    return routeError(error);
  }
}
