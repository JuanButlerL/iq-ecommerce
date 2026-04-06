import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock3, FileText, RefreshCcw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { RetrySyncButton } from "@/features/admin/components/retry-sync-button";
import { OrderStatusForm } from "@/features/admin/components/order-status-form";
import { getOrderDetail } from "@/features/orders/queries";
import { requireAdmin } from "@/lib/auth/admin";
import { createPaymentProofSignedUrl } from "@/lib/storage/payment-proofs";
import { formatArs } from "@/lib/utils/currency";

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
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="space-y-2 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Total</p>
          <p className="text-2xl font-extrabold text-brand-ink">{formatArs(order.totalArs)}</p>
        </Card>
        <Card className="space-y-2 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Pago</p>
          <p className="text-sm font-bold text-brand-ink">{order.paymentStatus}</p>
        </Card>
        <Card className="space-y-2 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Pedido</p>
          <p className="text-sm font-bold text-brand-ink">{order.orderStatus}</p>
        </Card>
        <Card className="space-y-2 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Sync</p>
          <p className="text-sm font-bold text-brand-ink">{order.syncStatus}</p>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card className="space-y-4 p-6">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Datos del cliente</p>
          <p className="text-brand-ink">
            {order.customerFirstName} {order.customerLastName}
          </p>
          <p className="text-brand-ink/70">{order.customerEmail}</p>
          <p className="text-brand-ink/70">{order.customerPhone}</p>
          <p className="text-brand-ink/70">
            {order.addressLine} {order.addressExtra}
          </p>
          <p className="text-brand-ink/70">
            {order.locality}, {order.province}, {order.postalCode}
          </p>
          <div className="space-y-2 border-t border-brand-ink/10 pt-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm text-brand-ink/70">
                <span>
                  {item.productNameSnapshot} x {item.quantity}
                </span>
                <span>{formatArs(item.lineTotalArs)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 rounded-[1.5rem] bg-background p-4 text-sm text-brand-ink/70">
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-bold text-brand-ink">{formatArs(order.subtotalArs)}</span>
            </div>
            {order.discountArs > 0 ? (
              <div className="flex items-center justify-between">
                <span>
                  Cupon {order.couponCode} ({Number(order.discountPercentage ?? 0)}%)
                </span>
                <span className="font-bold text-green-700">- {formatArs(order.discountArs)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span>Envio</span>
              <span className="font-bold text-brand-ink">{formatArs(order.shippingArs)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-brand-ink/10 pt-2">
              <span>Total</span>
              <span className="font-bold text-brand-ink">{formatArs(order.totalArs)}</span>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Comprobante</p>
                <p className="mt-2 text-sm text-brand-ink/70">
                  Datos clave para conciliar rapido el pago con el pedido.
                </p>
              </div>
              {proofUrl ? (
                <Link
                  href={proofUrl}
                  target="_blank"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-pink px-4 py-2 text-sm font-bold text-white"
                >
                  <FileText className="h-4 w-4" />
                  Ver comprobante
                </Link>
              ) : null}
            </div>
            {latestProof ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-[1.5rem] border border-brand-ink/10 bg-background">
                  {proofUrl && latestProof.mimeType === "application/pdf" ? (
                    <iframe
                      src={proofUrl}
                      title={`Comprobante ${latestProof.fileName}`}
                      className="h-[520px] w-full bg-white"
                    />
                  ) : proofUrl && latestProof.mimeType.startsWith("image/") ? (
                    <img
                      src={proofUrl}
                      alt={`Comprobante ${latestProof.fileName}`}
                      className="max-h-[520px] w-full object-contain bg-white"
                    />
                  ) : (
                    <div className="flex min-h-[220px] items-center justify-center p-6 text-center text-sm text-brand-ink/60">
                      No se puede previsualizar este archivo en pantalla. Abrilo desde &quot;Ver comprobante&quot;.
                    </div>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[1.5rem] bg-background p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">DNI informado</p>
                    <p className="mt-2 font-bold text-brand-ink">{latestProof.transferSenderName ?? "No informado"}</p>
                  </div>
                  <div className="rounded-[1.5rem] bg-background p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Fecha informada</p>
                    <p className="mt-2 font-bold text-brand-ink">
                      {latestProof.transferDate ? latestProof.transferDate.toLocaleString("es-AR") : "No informada"}
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] bg-background p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Referencia</p>
                    <p className="mt-2 font-bold text-brand-ink">{latestProof.transferReference ?? "No informada"}</p>
                  </div>
                  <div className="rounded-[1.5rem] bg-background p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Archivo</p>
                    <p className="mt-2 font-bold text-brand-ink">{latestProof.fileName}</p>
                  </div>
                  <div className="rounded-[1.5rem] bg-background p-4 md:col-span-2">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink/50">Nota del cliente</p>
                    <p className="mt-2 text-brand-ink">{latestProof.customerNote ?? "Sin nota adicional."}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-brand-ink/50">Todavia no hay comprobante cargado.</p>
            )}
          </Card>
          <Card className="space-y-4 p-6">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand-ink/50">Estados</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-[1.25rem] bg-background p-4 text-sm text-brand-ink">
                <Clock3 className="h-4 w-4 text-brand-pink" />
                Estado del pedido: {order.orderStatus}
              </div>
              <div className="flex items-center gap-3 rounded-[1.25rem] bg-background p-4 text-sm text-brand-ink">
                <CheckCircle2 className="h-4 w-4 text-brand-pink" />
                Estado del pago: {order.paymentStatus}
              </div>
              <div className="flex items-center gap-3 rounded-[1.25rem] bg-background p-4 text-sm text-brand-ink">
                <RefreshCcw className="h-4 w-4 text-brand-pink" />
                Sync: {order.syncStatus}
              </div>
            </div>
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
