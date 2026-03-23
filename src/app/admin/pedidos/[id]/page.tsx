import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/card";
import { RetrySyncButton } from "@/features/admin/components/retry-sync-button";
import { OrderStatusForm } from "@/features/admin/components/order-status-form";
import { getOrderDetail } from "@/features/orders/queries";
import { requireAdmin } from "@/lib/auth/admin";
import { createPaymentProofSignedUrl } from "@/lib/storage/payment-proofs";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const order = await getOrderDetail(id);

  if (!order) {
    notFound();
  }

  const latestProof = order.paymentProofs[0];
  const proofUrl = latestProof ? await createPaymentProofSignedUrl(latestProof.storagePath) : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-brand-pink">Pedido</p>
        <h1 className="font-display text-5xl text-brand-ink">{order.publicOrderNumber}</h1>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card className="space-y-4 p-6">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Datos del cliente</p>
          <p className="text-brand-ink">{order.customerFirstName} {order.customerLastName}</p>
          <p className="text-brand-ink/70">{order.customerEmail}</p>
          <p className="text-brand-ink/70">{order.customerPhone}</p>
          <p className="text-brand-ink/70">{order.addressLine} {order.addressExtra}</p>
          <p className="text-brand-ink/70">{order.locality}, {order.province}, {order.postalCode}</p>
          <div className="space-y-2 border-t border-brand-ink/10 pt-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm text-brand-ink/70">
                <span>{item.productNameSnapshot} x {item.quantity}</span>
                <span>${item.lineTotalArs.toLocaleString("es-AR")}</span>
              </div>
            ))}
          </div>
          {proofUrl ? (
            <Link href={proofUrl} target="_blank" className="inline-flex font-bold text-brand-pink">
              Ver comprobante
            </Link>
          ) : (
            <p className="text-sm text-brand-ink/50">Todavia no hay comprobante cargado.</p>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4 p-6">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Estados</p>
            <p className="text-brand-ink">Order status: {order.orderStatus}</p>
            <p className="text-brand-ink/70">Payment status: {order.paymentStatus}</p>
            <p className="text-brand-ink/70">Sync status: {order.syncStatus}</p>
            <OrderStatusForm orderId={order.id} currentStatus={order.orderStatus} />
            <RetrySyncButton orderNumber={order.publicOrderNumber} />
          </Card>
          <Card className="space-y-3 p-6">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Historial</p>
            {order.statusHistory.map((event) => (
              <div key={event.id} className="rounded-[1.5rem] bg-background p-4 text-sm text-brand-ink/70">
                <p className="font-bold text-brand-ink">{event.status}</p>
                <p>{event.note ?? "Sin nota"}</p>
                <p>{event.createdAt.toLocaleString("es-AR")}</p>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
