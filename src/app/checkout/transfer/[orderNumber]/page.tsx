import { notFound } from "next/navigation";

import { PaymentProofForm } from "@/features/checkout/components/payment-proof-form";
import { getOrderByNumber } from "@/features/orders/services/order-service";
import { getStoreSettings } from "@/features/settings/queries";
import { formatArs } from "@/lib/utils/currency";

export default async function TransferPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const [order, settings] = await Promise.all([getOrderByNumber(orderNumber), getStoreSettings()]);

  if (!order || !settings) {
    notFound();
  }

  if (order.paymentMethod !== "BANK_TRANSFER") {
    notFound();
  }

  return (
    <section className="min-h-screen bg-[linear-gradient(180deg,#fff9f8_0%,#ffffff_18%,#ffffff_100%)] px-4 py-8 sm:px-6 md:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 md:gap-8">
        <div className="rounded-full border border-brand-ink/8 bg-white px-6 py-3 text-center text-lg font-extrabold tracking-[0.01em] text-brand-ink shadow-[0_10px_24px_rgba(44,34,65,0.05)] sm:px-8 sm:text-2xl">
          Pedido #: {order.publicOrderNumber}
        </div>

        <PaymentProofForm
          orderNumber={order.publicOrderNumber}
          amount={formatArs(order.totalArs)}
          alias={settings.bankAlias}
        />
      </div>
    </section>
  );
}
