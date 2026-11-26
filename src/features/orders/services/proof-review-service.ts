import { OrderStatus, PaymentStatus, SyncStatus } from "@prisma/client";

import { updateOrderStatus } from "@/features/orders/services/order-service";
import { syncOrder } from "@/features/orders/services/sync-service";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { createPaymentProofSignedUrl } from "@/lib/storage/payment-proofs";

// Revisión de comprobantes: el equipo aprueba o rechaza desde el admin. Recién al aprobar el pedido
// queda pago, se genera la etiqueta y viaja a la app de operaciones.

const PROOF_REVIEW_SINCE = new Date("2026-11-26T01:30:00Z");

export async function listProofsToReview() {
  const orders = await prisma.order.findMany({
    // Solo pedidos desde el pase a producción (25/11/2026 22:30 hora AR): antes nadie marcaba como pagados los
    // pedidos con comprobante, así que hay cientos viejos en ese estado que ya se entregaron.
    where: { orderStatus: OrderStatus.PROOF_UPLOADED, createdAt: { gte: PROOF_REVIEW_SINCE } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      paymentProofs: { orderBy: { uploadedAt: "desc" } },
      shipment: { select: { carrier: true, deliveryType: true, status: true } },
    },
  });

  return Promise.all(
    orders.map(async (order) => {
      const proofs = await Promise.all(
        order.paymentProofs.map(async (proof) => ({
          id: proof.id,
          fileName: proof.fileName,
          mimeType: proof.mimeType,
          uploadedAt: proof.uploadedAt,
          reviewStatus: proof.reviewStatus,
          rejectionReason: proof.rejectionReason,
          transferSenderName: proof.transferSenderName,
          transferDate: proof.transferDate,
          transferReference: proof.transferReference,
          customerNote: proof.customerNote,
          url: proof.publicUrl ?? (await createPaymentProofSignedUrl(proof.storagePath).catch(() => null)),
        })),
      );
      return {
        id: order.id,
        publicOrderNumber: order.publicOrderNumber,
        channel: order.channel,
        createdAt: order.createdAt,
        customerName: order.customerBusinessName || `${order.customerFirstName} ${order.customerLastName}`,
        customerEmail: order.customerEmail,
        customerTaxId: order.customerTaxId,
        paymentMethod: order.paymentMethod,
        totalArs: order.totalArs,
        shippingCarrier: order.shipment?.carrier ?? null,
        proofs,
      };
    }),
  );
}

export async function approvePaymentProof(orderId: string, actor: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { paymentProofs: { orderBy: { uploadedAt: "desc" }, take: 1 } } });
  if (!order) throw new AppError("Pedido no encontrado.", 404);
  if (order.orderStatus !== OrderStatus.PROOF_UPLOADED) {
    throw new AppError("Este pedido ya no está esperando revisión del comprobante.", 409);
  }
  // Los pedidos de antes del pase a producción se manejan como siempre (etiqueta manual): aprobarlos acá
  // los reenviaría a la planilla y a la app.
  if (order.createdAt < PROOF_REVIEW_SINCE) {
    throw new AppError("Este pedido es de antes del 25/11 a la noche: se maneja como antes, con etiqueta manual.", 409);
  }
  const proof = order.paymentProofs[0];
  if (proof) {
    await prisma.paymentProof.update({
      where: { id: proof.id },
      data: { reviewStatus: "APPROVED", reviewedAt: new Date(), reviewedBy: actor, rejectionReason: null },
    });
  }
  // Pasa a pagado: sincroniza la planilla, cuenta para referidos y genera la etiqueta.
  await updateOrderStatus(orderId, OrderStatus.PAID, `Comprobante aprobado por ${actor}.`, actor);
}

export async function rejectPaymentProof(orderId: string, actor: string, reason: string) {
  const cleanReason = reason.trim().slice(0, 300);
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { paymentProofs: { orderBy: { uploadedAt: "desc" }, take: 1 } } });
  if (!order) throw new AppError("Pedido no encontrado.", 404);
  if (order.orderStatus !== OrderStatus.PROOF_UPLOADED) {
    throw new AppError("Este pedido ya no está esperando revisión del comprobante.", 409);
  }
  if (order.createdAt < PROOF_REVIEW_SINCE) {
    throw new AppError("Este pedido es de antes del 25/11 a la noche: se maneja como antes, con etiqueta manual.", 409);
  }

  await prisma.$transaction(async (tx) => {
    const proof = order.paymentProofs[0];
    if (proof) {
      await tx.paymentProof.update({
        where: { id: proof.id },
        data: { reviewStatus: "REJECTED", reviewedAt: new Date(), reviewedBy: actor, rejectionReason: cleanReason || null },
      });
    }
    await tx.order.update({
      where: { id: orderId },
      data: { orderStatus: OrderStatus.PENDING_PAYMENT, paymentStatus: PaymentStatus.PENDING, syncStatus: SyncStatus.PENDING, syncLastError: null },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: OrderStatus.PENDING_PAYMENT,
        note: `Comprobante rechazado por ${actor}${cleanReason ? `: ${cleanReason}` : ""}. Se le pidió al cliente que lo suba de nuevo.`,
        changedBy: actor,
      },
    });
  });

  await syncOrder(orderId).catch(async (error) => {
    await prisma.order.update({ where: { id: orderId }, data: { syncStatus: SyncStatus.ERROR, syncLastError: error instanceof Error ? error.message : "Sync error" } });
  });

  // Sin mail automático al cliente (decisión de Juan, 26/11): el equipo le avisa por WhatsApp.
  return { emailSent: false };
}
