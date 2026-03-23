"use server";

import { revalidatePath } from "next/cache";
import { OrderStatus } from "@prisma/client";

import { retryOrderSync } from "@/features/orders/services/sync-service";
import { updateOrderStatus } from "@/features/orders/services/order-service";

export async function retrySyncAction(orderId: string) {
  await retryOrderSync(orderId);

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/sync");
}

export async function updateOrderStatusAction(orderId: string, status: OrderStatus, note?: string) {
  await updateOrderStatus(orderId, status, note);

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${orderId}`);
}
