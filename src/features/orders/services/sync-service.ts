import { Prisma, SyncJobStatus, SyncLogStatus, SyncStatus } from "@prisma/client";

import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { getOrderSyncProvider } from "@/lib/integrations/sheets/factory";
import type { OrderItemSheetRow, OrderSheetRow, OrderSyncPayload } from "@/lib/integrations/sheets/types";
import { createPaymentProofSignedUrl } from "@/lib/storage/payment-proofs";

async function buildOrderSyncPayload(orderId: string): Promise<OrderSyncPayload> {
  const provider = getOrderSyncProvider();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      paymentProofs: {
        orderBy: {
          uploadedAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (!order) {
    throw new Error("Order not found for sync.");
  }

  const latestProof = order.paymentProofs[0];
  const proofUrl = latestProof
    ? latestProof.publicUrl ??
      (env.enableProofPublicUrlSync ? latestProof.publicUrl : await createPaymentProofSignedUrl(latestProof.storagePath))
    : "";

  const orderRow: OrderSheetRow = {
    order_id: order.id,
    public_order_number: order.publicOrderNumber,
    fecha_hora: order.createdAt.toISOString(),
    estado: order.orderStatus,
    payment_status: order.paymentStatus,
    customer_first_name: order.customerFirstName,
    customer_last_name: order.customerLastName,
    email: order.customerEmail,
    telefono: order.customerPhone,
    dni_cuit: order.customerTaxId ?? "",
    provincia: order.province,
    localidad: order.locality,
    codigo_postal: order.postalCode,
    direccion: order.addressLine,
    direccion_extra: order.addressExtra ?? "",
    observaciones: order.notes ?? "",
    subtotal: order.subtotalArs,
    envio: order.shippingArs,
    total: order.totalArs,
    medio_pago: order.paymentMethod,
    comprobante_url: proofUrl ?? "",
    fuente: order.source,
    created_at: order.createdAt.toISOString(),
  };

  const itemRows: OrderItemSheetRow[] = order.items.map((item) => ({
    order_item_id: item.id,
    order_id: item.orderId,
    product_id: item.productId ?? "",
    producto: item.productNameSnapshot,
    cantidad: item.quantity,
    precio_unitario: item.unitPriceArs,
    subtotal_item: item.lineTotalArs,
  }));

  return {
    provider: provider.provider,
    order: orderRow,
    items: itemRows,
  };
}

export async function syncOrder(orderId: string) {
  const provider = getOrderSyncProvider();
  const payload = await buildOrderSyncPayload(orderId);

  const syncJob = await prisma.syncJob.upsert({
    where: {
      id: await findExistingSyncJobId(orderId),
    },
    update: {
      provider: provider.provider,
      status: SyncJobStatus.PROCESSING,
      attempts: {
        increment: 1,
      },
      payloadSnapshot: payload,
      lastError: null,
    },
    create: {
      orderId,
      provider: provider.provider,
      status: SyncJobStatus.PROCESSING,
      attempts: 1,
      payloadSnapshot: payload,
    },
  });

  const result = await provider.syncOrder(payload);

  await prisma.syncLog.create({
    data: {
      syncJobId: syncJob.id,
      attemptNumber: syncJob.attempts,
      requestPayload: result.requestPayload,
      responsePayload: toJsonValue(result.responsePayload),
      status: result.success ? SyncLogStatus.SUCCESS : SyncLogStatus.ERROR,
      errorMessage: result.errorMessage,
    },
  });

  if (!result.success) {
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: SyncJobStatus.ERROR,
        lastError: result.errorMessage,
        nextRetryAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });

    await prisma.order.update({
      where: { id: orderId },
      data: {
        syncStatus: SyncStatus.ERROR,
        syncLastError: result.errorMessage,
      },
    });

    return result;
  }

  await prisma.syncJob.update({
    where: { id: syncJob.id },
    data: {
      status: SyncJobStatus.SUCCESS,
      lastError: null,
      nextRetryAt: null,
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: {
      syncStatus: SyncStatus.SUCCESS,
      syncLastError: null,
      syncedAt: new Date(),
    },
  });

  return result;
}

export async function retryOrderSync(orderId: string) {
  return syncOrder(orderId);
}

async function findExistingSyncJobId(orderId: string) {
  const existing = await prisma.syncJob.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });

  return existing?.id ?? crypto.randomUUID();
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
