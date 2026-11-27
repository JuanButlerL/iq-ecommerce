import { Prisma, type ShipmentStatus, type ShippingCarrier, type ShippingDeliveryType } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { sendEmail } from "@/features/email/provider";
import { syncOrder } from "@/features/orders/services/sync-service";
import { computeDispatchDate, dateKeyToDbDate, dbDateToKey, formatDispatchDate } from "@/features/logistics/business-days";
import { CARRIER_LABELS, findOwnZone } from "@/features/logistics/options";
import { arrivalRange, carrierTransitDays, withWindow } from "@/features/logistics/transit";
import { splitStreetNumber } from "@/features/logistics/checkout";
import { computePackage, type PackageLine } from "@/features/logistics/package";
import { getDefaultWarehouse, getHolidayCalendar, getShippingSettings } from "@/features/logistics/settings";
import { buildShipmentConfirmedEmail, trackingUrlFor } from "@/features/logistics/shipping-email";
import { getCarrierAdapter } from "@/lib/integrations/logistics";
import { redact } from "@/lib/integrations/logistics/http";
import { CarrierError, type CarrierCode, type CreateShipmentRequest, type CreatedShipment } from "@/lib/integrations/logistics/types";
import { uploadShippingLabel } from "@/lib/storage/shipping-labels";

// Minutos de espera entre intentos. Después del último, cada 4 horas, sin límite: "hasta que funque".
export const RETRY_DELAYS_MINUTES = [1, 5, 15, 30, 60, 120, 240];
// A partir de este intento el admin muestra una alerta.
export const ALERT_AFTER_ATTEMPTS = 4;
const LOCK_MS = 2 * 60 * 1000;
const BATCH_SIZE = 10;

export function nextAttemptDelayMinutes(attempts: number) {
  return RETRY_DELAYS_MINUTES[Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MINUTES.length - 1)];
}

type Tx = Prisma.TransactionClient;

async function logEvent(db: Tx | typeof prisma, shipmentId: string, kind: string, message: string, actor?: string) {
  await db.shipmentEvent.create({ data: { shipmentId, kind, message: message.slice(0, 1000), actor } });
}

// Al crear el pedido: el envío queda esperando el pago.
export async function createShipmentForOrder(tx: Tx, input: { orderId: string; carrier: ShippingCarrier; deliveryType: ShippingDeliveryType }) {
  const shipment = await tx.shipment.create({
    data: { orderId: input.orderId, carrier: input.carrier, deliveryType: input.deliveryType, status: "WAITING_PAYMENT" },
  });
  await logEvent(tx, shipment.id, "created", `Envío ${CARRIER_LABELS[input.carrier]} esperando la confirmación del pago.`, "sistema");
  return shipment;
}

// La venta quedó confirmada (MP acreditado, comprobante aprobado o pedido mayorista aprobado): se calcula la
// fecha de despacho y se genera la etiqueta. Idempotente: si ya se liberó, no hace nada.
export async function releaseShipment(orderId: string, actor: string, options: { processNow?: boolean } = {}) {
  const shipment = await prisma.shipment.findUnique({ where: { orderId } });
  if (!shipment || shipment.status !== "WAITING_PAYMENT") return shipment;

  const [settings, calendar] = await Promise.all([getShippingSettings(), getHolidayCalendar()]);
  const dispatchKey = computeDispatchDate(new Date(), settings, calendar);
  const dispatchDate = dateKeyToDbDate(dispatchKey);

  const released = await prisma.$transaction(async (tx) => {
    const updated = await tx.shipment.updateMany({
      where: { id: shipment.id, status: "WAITING_PAYMENT" },
      data: { status: "PENDING", dispatchDate, nextAttemptAt: new Date(), lastError: null },
    });
    if (updated.count === 0) return false;
    await tx.order.update({ where: { id: orderId }, data: { estimatedDispatchDate: dispatchDate } });
    await logEvent(tx, shipment.id, "released", `Pago confirmado. Despacho: ${formatDispatchDate(dispatchKey)}.`, actor);
    return true;
  });

  if (released && options.processNow !== false) {
    await processShipment(shipment.id).catch((error) => {
      console.error("[logistica] no se pudo generar la etiqueta en el momento", { orderId, error });
    });
  }
  return prisma.shipment.findUnique({ where: { orderId } });
}

// El pedido se canceló o venció. Si la etiqueta ya existe en el transportista, queda avisado para anularla.
export async function cancelShipmentForOrder(orderId: string, actor: string, reason: string) {
  const shipment = await prisma.shipment.findUnique({ where: { orderId } });
  if (!shipment || shipment.status === "CANCELLED") return;
  const wasCreatedAtCarrier = shipment.status === "CREATED" && shipment.carrier !== "OWN" && shipment.carrierShipmentId;
  let note = reason;

  if (wasCreatedAtCarrier) {
    const adapter = getCarrierAdapter(shipment.carrier as CarrierCode);
    if (adapter.cancelShipment) {
      try {
        await adapter.cancelShipment({ trackingNumber: shipment.trackingNumber ?? "", carrierShipmentId: shipment.carrierShipmentId ?? "" });
        note = `${reason} Etiqueta anulada en ${CARRIER_LABELS[shipment.carrier]}.`;
      } catch (error) {
        note = `${reason} No se pudo anular la etiqueta en ${CARRIER_LABELS[shipment.carrier]}: anulala desde su portal (${error instanceof Error ? error.message : "error"}).`;
      }
    } else {
      note = `${reason} La etiqueta ${shipment.trackingNumber ?? ""} ya estaba generada: anulala desde el portal de ${CARRIER_LABELS[shipment.carrier]}.`;
    }
  }

  await prisma.shipment.update({ where: { id: shipment.id }, data: { status: "CANCELLED", cancelledAt: new Date(), nextAttemptAt: null } });
  await logEvent(prisma, shipment.id, "cancelled", note, actor);
}

type ShipmentWithOrder = Prisma.ShipmentGetPayload<{
  include: {
    order: {
      include: {
        items: { include: { product: true; wholesaleProduct: { include: { components: { include: { product: true } } } } } };
      };
    };
  };
}>;

function packageLinesForOrder(order: ShipmentWithOrder["order"]): PackageLine[] {
  return order.items.map((item) => {
    const wholesale = item.wholesaleProduct;
    const source = wholesale ?? item.product;
    return {
      quantity: item.quantity + (item.freeUnits ?? 0),
      unit: {
        weightGrams: source?.weightGrams ?? null,
        lengthCm: source?.lengthCm ?? null,
        widthCm: source?.widthCm ?? null,
        heightCm: source?.heightCm ?? null,
      },
      components: wholesale?.components.map((component) => ({
        quantity: component.quantity,
        unit: {
          weightGrams: component.product.weightGrams,
          lengthCm: component.product.lengthCm,
          widthCm: component.product.widthCm,
          heightCm: component.product.heightCm,
        },
      })),
    };
  });
}

// Los pedidos mayoristas guardan calle y altura juntas: se separan para la etiqueta.
function destinationStreet(order: { addressLine: string; addressNumber: string | null; addressWithoutNumber: boolean | null }) {
  if (order.addressWithoutNumber) return { street: order.addressLine, number: "S/N" };
  if (order.addressNumber) return { street: order.addressLine, number: order.addressNumber };
  const split = splitStreetNumber(order.addressLine);
  return { street: split.street, number: split.number || "S/N" };
}

async function buildCreateRequest(shipment: ShipmentWithOrder): Promise<CreateShipmentRequest> {
  const order = shipment.order;
  const [settings, warehouse] = await Promise.all([getShippingSettings(), getDefaultWarehouse()]);
  if (!warehouse) throw new CarrierError("No hay un depósito de origen cargado en Admin > Logística.", "NOT_CONFIGURED");
  if (shipment.deliveryType === "BRANCH" && !order.shippingBranchId) {
    throw new CarrierError("El pedido es retiro en sucursal pero no tiene sucursal elegida.", "INVALID_DATA");
  }
  const pkg = computePackage(packageLinesForOrder(order), settings);
  return {
    reference: order.publicOrderNumber,
    deliveryType: shipment.deliveryType,
    branchId: order.shippingBranchId,
    sender: { fullName: warehouse.contactName || "IQ Kids", email: warehouse.email, phone: warehouse.phone, taxId: warehouse.taxId },
    origin: {
      street: warehouse.street,
      number: warehouse.number,
      floor: warehouse.floor,
      locality: warehouse.locality,
      province: warehouse.province,
      postalCode: warehouse.postalCode,
    },
    recipient: {
      fullName: order.customerBusinessName || `${order.customerFirstName} ${order.customerLastName}`.trim(),
      email: order.customerEmail,
      phone: order.customerPhone,
      taxId: order.customerTaxId,
    },
    destination: {
      ...destinationStreet(order),
      floor: order.addressExtra,
      locality: order.locality,
      province: order.province,
      postalCode: order.postalCode,
    },
    // Valor declarado: lo que pagó por los productos.
    pkg: { ...pkg, declaredValueArs: Math.max(1, order.totalArs - order.shippingArs) },
    notes: order.notes,
  };
}

// Toma el envío con un lock corto para que dos procesos no generen dos etiquetas.
async function claim(shipmentId: string) {
  const now = new Date();
  const claimed = await prisma.shipment.updateMany({
    where: {
      id: shipmentId,
      status: { in: ["PENDING", "ERROR"] },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
    data: { status: "PROCESSING", lockedUntil: new Date(now.getTime() + LOCK_MS), attempts: { increment: 1 } },
  });
  return claimed.count === 1;
}

async function finishCreated(shipment: ShipmentWithOrder, created: CreatedShipment, actor: string) {
  let labelStoragePath: string | null = null;
  if (created.label?.data?.length) {
    labelStoragePath = (await uploadShippingLabel(created.label.data, shipment.order.publicOrderNumber, created.label.contentType)).storagePath;
  }
  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: "CREATED",
      trackingNumber: created.trackingNumber,
      carrierShipmentId: created.carrierShipmentId,
      labelStoragePath,
      labelCreatedAt: new Date(),
      lockedUntil: null,
      nextAttemptAt: null,
      lastError: null,
      lastResponse: redact(created.raw) as Prisma.InputJsonValue,
    },
  });
  await logEvent(
    prisma,
    shipment.id,
    "label_created",
    `Envío generado en ${CARRIER_LABELS[shipment.carrier]}: ${created.trackingNumber}${labelStoragePath ? "" : " (etiqueta pendiente de descargar)"}.`,
    actor,
  );
}

async function finishOwn(shipment: ShipmentWithOrder, actor: string) {
  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: "CREATED",
      trackingNumber: shipment.order.publicOrderNumber,
      carrierShipmentId: shipment.order.publicOrderNumber,
      labelCreatedAt: new Date(),
      lockedUntil: null,
      nextAttemptAt: null,
      lastError: null,
    },
  });
  await logEvent(prisma, shipment.id, "label_created", "Reparto propio: la etiqueta la genera la app de operaciones.", actor);
}

async function finishFailed(shipment: ShipmentWithOrder, error: unknown, attempts: number) {
  const carrierError = error instanceof CarrierError ? error : null;
  const message = error instanceof Error ? error.message : String(error);
  // Una respuesta ambigua puede haber creado el envío: no se reintenta sola para no duplicar la etiqueta,
  // salvo que el transportista rechace las altas repetidas (Correo).
  const idempotent = shipment.carrier !== "OWN" && Boolean(getCarrierAdapter(shipment.carrier as CarrierCode).idempotentCreate);
  const status: ShipmentStatus = carrierError?.kind === "AMBIGUOUS" && !idempotent ? "NEEDS_REVIEW" : "ERROR";
  const delay = carrierError?.kind === "INVALID_DATA" ? Math.max(60, nextAttemptDelayMinutes(attempts)) : nextAttemptDelayMinutes(attempts);
  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status,
      lockedUntil: null,
      lastError: message.slice(0, 1000),
      nextAttemptAt: status === "ERROR" ? new Date(Date.now() + delay * 60_000) : null,
      lastResponse: carrierError?.details ? (redact(carrierError.details) as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
  await logEvent(
    prisma,
    shipment.id,
    status === "NEEDS_REVIEW" ? "needs_review" : "error",
    status === "NEEDS_REVIEW"
      ? `${message} Revisá en ${CARRIER_LABELS[shipment.carrier]} si existe un envío con la referencia ${shipment.order.publicOrderNumber}; si no existe, tocá "Reintentar".`
      : `Intento ${attempts}: ${message}. Próximo intento en ${delay} min.`,
    "sistema",
  );
}

const shipmentInclude = {
  order: {
    include: {
      items: { include: { product: true, wholesaleProduct: { include: { components: { include: { product: true } } } } } },
    },
  },
} satisfies Prisma.ShipmentInclude;

export async function processShipment(shipmentId: string, actor = "sistema") {
  if (!(await claim(shipmentId))) return { processed: false as const };
  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId }, include: shipmentInclude });

  try {
    if (shipment.carrier === "OWN") {
      await finishOwn(shipment, actor);
    } else {
      const adapter = getCarrierAdapter(shipment.carrier as CarrierCode);
      // Si un intento anterior quedó ambiguo y alguien tocó Reintentar, primero se busca por referencia.
      const existing = shipment.attempts > 1 ? await adapter.findByReference(shipment.order.publicOrderNumber).catch(() => null) : null;
      if (existing) {
        await finishCreated(shipment, existing, actor);
      } else {
        const request = await buildCreateRequest(shipment);
        await prisma.shipment.update({ where: { id: shipment.id }, data: { lastRequest: redact(request) as Prisma.InputJsonValue } });
        const created = await adapter.createShipment(request);
        await finishCreated(shipment, created, actor);
      }
    }
  } catch (error) {
    await finishFailed(shipment, error, shipment.attempts);
    return { processed: true as const, success: false as const, error: error instanceof Error ? error.message : String(error) };
  }

  await afterCreated(shipment.id);
  return { processed: true as const, success: true as const };
}

// Con la etiqueta lista: la planilla recibe tracking y etiqueta, y el cliente el mail.
async function afterCreated(shipmentId: string) {
  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId }, include: { order: true } });
  await prisma.order.update({ where: { id: shipment.orderId }, data: { syncStatus: "PENDING", syncLastError: null } });
  await syncOrder(shipment.orderId).catch((error) => {
    console.error("[logistica] no se pudo sincronizar el pedido con la etiqueta", { orderId: shipment.orderId, error });
  });
  await notifyCustomer(shipment.id).catch((error) => {
    console.error("[logistica] no se pudo mandar el mail de envío", { shipmentId, error });
  });
}

export function describeDeliveryWindow(order: { shippingCarrier: ShippingCarrier | null }, days: { min: number | null; max: number | null }) {
  if (!days.min && !days.max) return null;
  const min = days.min ?? days.max;
  const max = days.max ?? days.min;
  if (min === max) return `en ${min} día${min === 1 ? "" : "s"} hábil${min === 1 ? "" : "es"} desde el despacho`;
  return `entre ${min} y ${max} días hábiles desde el despacho`;
}

export function shipmentDestinationLabel(order: {
  shippingDeliveryType: ShippingDeliveryType | null;
  shippingBranchName: string | null;
  shippingBranchAddress: string | null;
  addressLine: string;
  addressNumber: string | null;
  locality: string;
  province: string;
}) {
  if (order.shippingDeliveryType === "BRANCH") {
    return [order.shippingBranchName, order.shippingBranchAddress].filter(Boolean).join(" · ");
  }
  return [[order.addressLine, order.addressNumber].filter(Boolean).join(" "), order.locality, order.province].filter(Boolean).join(", ");
}

// Cuándo llega: reparto propio = días de la zona + franja ("hoy, jueves 26/11, entre las 14 y las 17 h");
// Andreani/Correo = días por región de Admin > Logística ("entre el lunes 30/11 y el martes 01/12").
export async function arrivalLabelFor(
  carrier: string,
  order: { postalCode: string; locality: string; province: string },
  dispatchDate: Date | null,
) {
  if (!dispatchDate) return null;
  const [settings, calendar] = await Promise.all([getShippingSettings(), getHolidayCalendar()]);
  if (carrier === "OWN") {
    const zone = await findOwnZone(order.postalCode, order.locality);
    const min = zone?.deliveryDaysMin ?? 0;
    const max = zone?.deliveryDaysMax ?? min;
    return withWindow(arrivalRange(dbDateToKey(dispatchDate), min, max, calendar).label, settings.ownDeliveryWindow);
  }
  const [min, max] = carrierTransitDays(order.province, settings);
  return arrivalRange(dbDateToKey(dispatchDate), min, max, calendar).label;
}

// Copia extra temporal (por ejemplo, alguien que quiere ver los mails unos días): variables
// SHIPPING_EMAIL_EXTRA_BCC y SHIPPING_EMAIL_EXTRA_BCC_UNTIL (AAAA-MM-DD, inclusive) en el servidor.
function temporaryShippingCopy() {
  const address = process.env.SHIPPING_EMAIL_EXTRA_BCC?.trim();
  const until = process.env.SHIPPING_EMAIL_EXTRA_BCC_UNTIL?.trim();
  if (!address || !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(address)) return null;
  if (until && /^\d{4}-\d{2}-\d{2}$/.test(until) && new Date().toISOString().slice(0, 10) > until) return null;
  return address;
}

export async function notifyCustomer(shipmentId: string) {
  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId }, include: { order: { include: { items: true } } } });
  if (shipment.status !== "CREATED" || shipment.customerNotifiedAt || !env.canSendEmail) return false;
  const order = shipment.order;
  const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const orderUrl = order.channel === "WHOLESALE" ? `${siteUrl}/mayoristas/pedido/${order.publicOrderNumber}` : `${siteUrl}/checkout/confirmacion/${order.publicOrderNumber}`;
  const email = buildShipmentConfirmedEmail({
    firstName: order.customerFirstName,
    orderNumber: order.publicOrderNumber,
    carrierLabel: shipment.carrier === "OWN" ? CARRIER_LABELS.OWN : `${CARRIER_LABELS[shipment.carrier]} · ${shipment.deliveryType === "BRANCH" ? "retiro en sucursal" : "a domicilio"}`,
    isOwnDelivery: shipment.carrier === "OWN",
    deliveryType: shipment.deliveryType,
    trackingNumber: shipment.trackingNumber,
    trackingUrl: trackingUrlFor(shipment.carrier, shipment.trackingNumber),
    dispatchDateLabel: shipment.dispatchDate ? formatDispatchDate(dbDateToKey(shipment.dispatchDate)) : null,
    deliveryWindowLabel: await arrivalLabelFor(shipment.carrier, order, shipment.dispatchDate),
    destination: shipmentDestinationLabel(order),
    orderUrl,
    summary: {
      items: order.items.map((item) => ({ name: item.productNameSnapshot, quantity: item.quantity, totalArs: item.lineTotalArs })),
      shippingArs: order.shippingArs,
      totalArs: order.totalArs,
    },
  });
  // Copia oculta: la lista de Admin > Logística (y una copia temporal opcional del servidor).
  const copySettings = await getShippingSettings().catch(() => null);
  await sendEmail({
    fromEmail: env.EMAIL_FROM_DEFAULT,
    senderName: "IQ Kids",
    to: order.customerEmail,
    bccEmail: [copySettings?.shippingEmailBcc?.trim(), temporaryShippingCopy()].filter(Boolean).join(", ") || null,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  await prisma.shipment.update({ where: { id: shipment.id }, data: { customerNotifiedAt: new Date() } });
  await logEvent(prisma, shipment.id, "customer_notified", `Mail de envío mandado a ${order.customerEmail}.`, "sistema");
  return true;
}

// Etiquetas que Andreani dejó "pendientes": se vuelve a pedir el PDF.
async function fetchMissingLabels() {
  const rows = await prisma.shipment.findMany({
    where: { status: "CREATED", carrier: "ANDREANI", labelStoragePath: null, trackingNumber: { not: null }, createdAt: { gte: new Date(Date.now() - 7 * 24 * 3_600_000) } },
    include: { order: true },
    take: BATCH_SIZE,
  });
  let fetched = 0;
  for (const row of rows) {
    try {
      const label = await getCarrierAdapter("ANDREANI").fetchLabel({ trackingNumber: row.trackingNumber ?? "", carrierShipmentId: row.carrierShipmentId ?? "" });
      if (!label) continue;
      const { storagePath } = await uploadShippingLabel(label.data, row.order.publicOrderNumber, label.contentType);
      await prisma.shipment.update({ where: { id: row.id }, data: { labelStoragePath: storagePath } });
      await logEvent(prisma, row.id, "label_fetched", "Etiqueta descargada.", "sistema");
      await prisma.order.update({ where: { id: row.orderId }, data: { syncStatus: "PENDING" } });
      await syncOrder(row.orderId).catch(() => undefined);
      fetched += 1;
    } catch (error) {
      console.error("[logistica] etiqueta pendiente", { shipmentId: row.id, error });
    }
  }
  return fetched;
}

// Cron: genera las etiquetas que faltan, reintenta las que fallaron y manda los mails que quedaron pendientes.
export async function processPendingShipments() {
  const due = await prisma.shipment.findMany({
    where: {
      OR: [
        { status: { in: ["PENDING", "ERROR"] }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] },
        // Procesos cortados a mitad de camino.
        { status: "PROCESSING", lockedUntil: { lt: new Date() } },
      ],
    },
    orderBy: { nextAttemptAt: "asc" },
    take: BATCH_SIZE,
    select: { id: true, status: true, carrier: true },
  });

  const results = [];
  for (const row of due) {
    if (row.status === "PROCESSING") {
      // Un proceso que se cortó a mitad del alta: puede haber creado el envío. Correo permite buscarlo por
      // referencia y se reintenta; Andreani no, así que queda para revisar y no se duplica la etiqueta.
      if (row.carrier === "ANDREANI") {
        await prisma.shipment.update({
          where: { id: row.id },
          data: { status: "NEEDS_REVIEW", lockedUntil: null, lastError: "El proceso se cortó mientras se generaba la etiqueta." },
        });
        await logEvent(prisma, row.id, "needs_review", "El proceso se cortó mientras se generaba la etiqueta. Revisá en Andreani si existe y, si no, tocá Reintentar.", "sistema");
        continue;
      }
      await prisma.shipment.update({ where: { id: row.id }, data: { status: "ERROR", lockedUntil: null } });
    }
    results.push({ id: row.id, ...(await processShipment(row.id)) });
  }

  const labels = await fetchMissingLabels();
  const unnotified = await prisma.shipment.findMany({
    where: { status: "CREATED", customerNotifiedAt: null, createdAt: { gte: new Date(Date.now() - 3 * 24 * 3_600_000) } },
    select: { id: true },
    take: BATCH_SIZE,
  });
  let notified = 0;
  for (const row of unnotified) {
    if (await notifyCustomer(row.id).catch(() => false)) notified += 1;
  }

  return { processed: results.length, failed: results.filter((r) => r.processed && !r.success).length, labelsFetched: labels, notified };
}

// Acciones del admin.
export async function retryShipmentNow(shipmentId: string, actor: string) {
  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
  if (!["ERROR", "NEEDS_REVIEW", "PENDING", "WAITING_PAYMENT"].includes(shipment.status)) {
    throw new Error("Este envío no se puede reintentar.");
  }
  if (shipment.status === "WAITING_PAYMENT") {
    // Generación manual antes de que se confirme el pago (ej. mayorista con pago diferido).
    await prisma.shipment.update({ where: { id: shipmentId }, data: { createdManually: true } });
    return releaseShipment(shipment.orderId, actor);
  }
  await prisma.shipment.update({ where: { id: shipmentId }, data: { status: "ERROR", nextAttemptAt: new Date(), lockedUntil: null } });
  await logEvent(prisma, shipmentId, "manual_retry", "Reintento manual.", actor);
  return processShipment(shipmentId, actor);
}

export async function setManualTracking(shipmentId: string, trackingNumber: string, actor: string) {
  const value = trackingNumber.trim();
  if (!value) throw new Error("Ingresá el número de seguimiento.");
  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
  await prisma.shipment.update({
    where: { id: shipmentId },
    data: { status: "CREATED", trackingNumber: value, carrierShipmentId: shipment.carrierShipmentId ?? value, createdManually: true, nextAttemptAt: null, lockedUntil: null, lastError: null, labelCreatedAt: new Date() },
  });
  await logEvent(prisma, shipmentId, "manual_tracking", `Seguimiento cargado a mano: ${value}.`, actor);
  await afterCreated(shipmentId);
}

export function detectLabelType(data: Buffer) {
  if (data.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  return null;
}

export async function attachManualLabel(shipmentId: string, file: File, actor: string) {
  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId }, include: { order: true } });
  const data = Buffer.from(await file.arrayBuffer());
  const contentType = detectLabelType(data);
  if (!contentType) throw new Error("La etiqueta tiene que ser un PDF, PNG o JPG.");
  const { storagePath } = await uploadShippingLabel(data, shipment.order.publicOrderNumber, contentType);
  await prisma.shipment.update({ where: { id: shipmentId }, data: { labelStoragePath: storagePath } });
  await logEvent(prisma, shipmentId, "manual_label", `Etiqueta subida a mano (${file.name}).`, actor);
  await prisma.order.update({ where: { id: shipment.orderId }, data: { syncStatus: "PENDING" } });
  await syncOrder(shipment.orderId).catch(() => undefined);
}
