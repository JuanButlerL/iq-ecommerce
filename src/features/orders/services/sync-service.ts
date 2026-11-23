import { OrderStatus, Prisma, SyncJobStatus, SyncLogStatus, SyncProvider, SyncStatus } from "@prisma/client";

import { env } from "@/lib/env";
import { prisma } from "@/lib/db/prisma";
import { getOrderSyncProvider } from "@/lib/integrations/sheets/factory";
import type { OrderItemSheetRow, OrderSheetRow, OrderSyncPayload, OrderSyncResult } from "@/lib/integrations/sheets/types";
import { explodeOrderItem, parseComponentsSnapshot } from "@/features/wholesale/bundles";
import { getInvoiceType, TAX_CONDITION_LABELS } from "@/features/wholesale/tax-condition";
import { createPaymentProofSignedUrl } from "@/lib/storage/payment-proofs";
import { formatArgentinaDateTime } from "@/lib/utils/datetime";
import { createShippingLabelUrl } from "@/lib/storage/shipping-labels";

const CARRIER_SHEET_LABELS = { OWN: "PROPIA", ANDREANI: "ANDREANI", CORREO_AR: "CORREO" } as const;

// dd/mm/aaaa, como el resto de las fechas de la planilla.
function formatSheetDate(date: Date | null | undefined) {
  if (!date) return "";
  const [y, m, d] = date.toISOString().slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

async function buildShippingColumns(order: {
  shippingCarrier: "OWN" | "ANDREANI" | "CORREO_AR" | null;
  shippingDeliveryType: "HOME" | "BRANCH" | null;
  shippingBranchId: string | null;
  shippingBranchName: string | null;
  estimatedDispatchDate: Date | null;
  shipment: { status: string; trackingNumber: string | null; labelStoragePath: string | null; dispatchDate: Date | null } | null;
}) {
  const shipment = order.shipment;
  const labelUrl = shipment?.labelStoragePath ? await createShippingLabelUrl(shipment.labelStoragePath).catch(() => "") : "";
  return {
    logistica: order.shippingCarrier ? CARRIER_SHEET_LABELS[order.shippingCarrier] : "",
    tipo_entrega: order.shippingDeliveryType === "BRANCH" ? "SUCURSAL" : order.shippingDeliveryType === "HOME" ? "DOMICILIO" : "",
    sucursal: order.shippingDeliveryType === "BRANCH" ? [order.shippingBranchId, order.shippingBranchName].filter(Boolean).join(" - ") : "",
    tracking: shipment?.trackingNumber ?? "",
    etiqueta_url: labelUrl,
    fecha_despacho: formatSheetDate(shipment?.dispatchDate ?? order.estimatedDispatchDate),
    estado_envio: shipment?.status ?? "",
  } as const;
}

// Primer intento y un reintento rápido (el cliente está esperando); el resto lo levanta el cron.
const SYNC_RETRY_DELAYS_MS = [0, 3_000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildOrderSyncPayload(orderId: string): Promise<OrderSyncPayload> {
  const provider = getOrderSyncProvider();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { wholesaleProduct: { select: { productId: true } } } },
      wholesaleCustomer: true,
      shipment: true,
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
    ...(await buildShippingColumns(order)),
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

  // La planilla a veces está ocupada (Apps Script devuelve "Lock timeout") o tarda en responder.
  // Reintentamos acá mismo unas veces antes de dejar el pedido en ERROR; el cron de reintentos
  // (/api/cron/order-sync) levanta lo que siga fallando.
  let result: OrderSyncResult | undefined;
  let attemptNumber = syncJob.attempts;

  for (let i = 0; i < SYNC_RETRY_DELAYS_MS.length; i += 1) {
    if (SYNC_RETRY_DELAYS_MS[i] > 0) {
      await sleep(SYNC_RETRY_DELAYS_MS[i]);
      attemptNumber += 1;
    }

    result = await provider.syncOrder(payload).catch(
      (error): OrderSyncResult => ({
        success: false,
        provider: provider.provider,
        requestPayload: payload,
        errorMessage: error instanceof Error ? error.message : "Sync error",
      }),
    );

    await prisma.syncLog.create({
      data: {
        syncJobId: syncJob.id,
        attemptNumber,
        requestPayload: result.requestPayload,
        responsePayload: toJsonValue(result.responsePayload),
        status: result.success ? SyncLogStatus.SUCCESS : SyncLogStatus.ERROR,
        errorMessage: result.errorMessage,
      },
    });

    if (result.success) {
      break;
    }
  }

  if (!result) {
    throw new Error("Sync did not run.");
  }

  if (attemptNumber !== syncJob.attempts) {
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: { attempts: attemptNumber },
    });
  }

  if (!result.success) {
    await prisma.syncJob.update({
      where: { id: syncJob.id },
      data: {
        status: SyncJobStatus.ERROR,
        lastError: result.errorMessage,
        nextRetryAt: new Date(Date.now() + 1000 * 60 * 10),
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

// Pedidos que quedaron sin llegar a la planilla (ERROR, o PENDING colgado por un corte a mitad de camino).
// Solo los últimos días, para no reenviar historia vieja.
const PENDING_SYNC_GRACE_MS = 1000 * 60 * 5;
const RETRY_LOOKBACK_MS = 1000 * 60 * 60 * 24 * 14;
const RETRY_BATCH_SIZE = 10;

export async function retryFailedOrderSyncs() {
  const now = Date.now();
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: new Date(now - RETRY_LOOKBACK_MS) },
      OR: [
        { syncStatus: SyncStatus.ERROR },
        { syncStatus: SyncStatus.PENDING, updatedAt: { lte: new Date(now - PENDING_SYNC_GRACE_MS) } },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: RETRY_BATCH_SIZE,
    select: { id: true, publicOrderNumber: true },
  });

  // Red de seguridad: pedidos pagos marcados como enviados cuyo último envío a la planilla
  // no fue confirmado por el Apps Script o mandó otro estado (ej. se envió PENDING_PAYMENT y hoy es PAID).
  if (orders.length < RETRY_BATCH_SIZE) {
    const pending = new Set(orders.map((order) => order.id));
    const outOfSync = await findPaidOrdersOutOfSync(now - RETRY_LOOKBACK_MS);
    for (const order of outOfSync) {
      if (orders.length >= RETRY_BATCH_SIZE) break;
      if (!pending.has(order.id)) orders.push(order);
    }
  }

  const results: { orderNumber: string; success: boolean; error?: string }[] = [];

  for (const order of orders) {
    try {
      const result = await syncOrder(order.id);
      results.push({ orderNumber: order.publicOrderNumber, success: result.success, error: result.errorMessage });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync error";
      await prisma.order.update({
        where: { id: order.id },
        data: { syncStatus: SyncStatus.ERROR, syncLastError: message },
      });
      results.push({ orderNumber: order.publicOrderNumber, success: false, error: message });
    }
  }

  return {
    checked: orders.length,
    synced: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

async function findPaidOrdersOutOfSync(since: number) {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: new Date(since) },
      syncStatus: SyncStatus.SUCCESS,
      orderStatus: { in: [OrderStatus.PAID, OrderStatus.PROOF_UPLOADED] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      publicOrderNumber: true,
      orderStatus: true,
      syncJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          provider: true,
          logs: {
            where: { status: SyncLogStatus.SUCCESS },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { requestPayload: true, responsePayload: true },
          },
        },
      },
    },
  });

  return orders
    .filter((order) => isOutOfSync(order.orderStatus, order.syncJobs[0]))
    .map((order) => ({ id: order.id, publicOrderNumber: order.publicOrderNumber }));
}

export function isOutOfSync(
  orderStatus: string,
  job: { provider: string; logs: { requestPayload: unknown; responsePayload: unknown }[] } | undefined,
) {
  const log = job?.logs[0];
  if (!job || !log) return true;

  const sentStatus = (log.requestPayload as { order?: { estado?: unknown } } | null)?.order?.estado;
  if (sentStatus !== orderStatus) return true;

  if (job.provider === SyncProvider.APPS_SCRIPT) {
    const response = log.responsePayload as { ok?: unknown } | null;
    if (!response || typeof response !== "object" || response.ok !== true) return true;
  }

  return false;
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
