import { OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { assertAdminSection } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";
import { updateOrderStatus } from "@/features/orders/services/order-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await assertAdminSection("orders");
    const { status, note } = (await request.json()) as { status: OrderStatus; note?: string };
    if (!Object.values(OrderStatus).includes(status)) {
      throw new AppError("Estado inválido.", 400, true);
    }
    const { id } = await params;
    // Queda registrado quién hizo el cambio (también en el historial del envío).
    await updateOrderStatus(id, status, note, session.adminUser.email);
    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${id}`);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
