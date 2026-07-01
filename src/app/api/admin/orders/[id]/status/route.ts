import { OrderStatus } from "@prisma/client";

import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";
import { updateOrderStatusAction } from "@/features/orders/mutations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdminSection("orders");
    const { status, note } = (await request.json()) as { status: OrderStatus; note?: string };
    const { id } = await params;
    await updateOrderStatusAction(id, status, note);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
