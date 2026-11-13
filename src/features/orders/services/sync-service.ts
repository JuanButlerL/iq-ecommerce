import { Prisma, SyncJobStatus, SyncLogStatus, SyncStatus } from "@prisma/client";

import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { getOrderSyncProvider } from "@/lib/integrations/sheets/factory";
import type { OrderItemSheetRow, OrderSheetRow, OrderSyncPayload } from "@/lib/integrations/sheets/types";
import { explodeOrderItem, parseComponentsSnapshot } from "@/features/wholesale/bundles";
import { getInvoiceType, TAX_CONDITION_LABELS } from "@/features/wholesale/tax-condition";
import { createPaymentProofSignedUrl } from "@/lib/storage/payment-proofs";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";

async function buildOrderSyncPayload(orderId: string): Promise<OrderSyncPayload> {
  const provider = getOrderSyncProvider();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { wholesaleProduct: { select: { productId: true } } } },
      wholesaleCustomer: true,
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

  const isWholesale = order.channel === "WHOLESALE";
  // The customer's registered address; the delivery address of the order can differ.
  const customer = order.wholesaleCustomer;
  const fiscalAddress = customer
    ? [
        [customer.street, customer.floor].filter(Boolean).join(" "),
        customer.city,
        customer.province,
        customer.postalCode ? `CP ${customer.postalCode}` : null,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  const orderRow: OrderSheetRow = {
    order_id: order.id,
    public_order_number: order.publicOrderNumber,
    fecha_hora: formatArgentinaDateTime(order.createdAt),
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
    // Preserve the legacy combined field for existing sync consumers.
    direccion: [order.addressLine, order.addressNumber].filter(Boolean).join(" "),
    calle: order.addressLine,
    altura: order.addressNumber ?? "",
    sin_altura: order.addressWithoutNumber === true,
    direccion_extra: order.addressExtra ?? "",
    observaciones: order.notes ?? "",
    cupon: order.couponCode ?? "",
    porcentaje_descuento: order.discountPercentage ? Number(order.discountPercentage) : 0,
    descuento: order.discountArs,
    subtotal: order.subtotalArs,
    envio: order.shippingArs,
    total: order.totalArs,
    medio_pago: order.paymentMethod,
    comprobante_url: proofUrl ?? "",
    fuente: isWholesale ? "MAYORISTA" : order.source,
    created_at: formatArgentinaDateTime(order.createdAt),
    canal: isWholesale ? "MAYORISTA" : "MINORISTA",
    razon_social: isWholesale ? (order.customerBusinessName ?? "") : "",
    condicion_iva: order.customerTaxCondition ? TAX_CONDITION_LABELS[order.customerTaxCondition] : "",
    tipo_factura: getInvoiceType(order.customerTaxCondition) ?? "",
    descuento_mayorista: order.extraDiscountArs,
    domicilio_fiscal: fiscalAddress,
  };

  const itemRows: OrderItemSheetRow[] = order.items.flatMap((item) => {
    // Bultos y cajas armadas viajan abiertos en sus displays base: una línea por producto de la tienda,
    // así la planilla y la app de operaciones los reciben sin configurar nada nuevo.
    const components = parseComponentsSnapshot(item.wholesaleComponents);

    if (components) {
      return explodeOrderItem({ ...item, components }).map((row) => ({
        order_item_id: row.key,
        order_id: item.orderId,
        product_id: row.productId,
        producto: row.name,
        cantidad: row.quantity,
        precio_unitario: row.unitPrice,
        subtotal_item: row.lineTotal,
      }));
    }

    return [
      {
        order_item_id: item.id,
        order_id: item.orderId,
        // Wholesale items take the retail product their wholesale product is linked to now,
        // so linking it in the admin fixes orders created while it was unlinked.
        product_id: item.productId ?? item.wholesaleProduct?.productId ?? "",
        producto: item.productNameSnapshot,
        cantidad: item.quantity,
        precio_unitario: item.unitPriceArs,
        subtotal_item: item.lineTotalArs,
      },
    ];
  });

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
