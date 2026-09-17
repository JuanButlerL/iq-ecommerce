import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { getProductsValue } from "@/lib/meta-commerce";

export async function sendGoogleAnalyticsPurchaseForOrder(orderId: string) {
  const measurementId = env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const apiSecret = env.GA_MEASUREMENT_PROTOCOL_API_SECRET;

  if (!measurementId || !apiSecret) {
    return false;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      publicOrderNumber: true,
      currency: true,
      totalArs: true,
      shippingArs: true,
      couponCode: true,
      paymentMethod: true,
      marketingSession: {
        select: { gaClientId: true },
      },
      items: {
        select: {
          productId: true,
          id: true,
          productNameSnapshot: true,
          unitPriceArs: true,
          quantity: true,
        },
      },
    },
  });

  const clientId = order?.marketingSession?.gaClientId;

  if (!order || !clientId) {
    return false;
  }

  const url = new URL("https://www.google-analytics.com/mp/collect");
  url.searchParams.set("measurement_id", measurementId);
  url.searchParams.set("api_secret", apiSecret);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: order.publicOrderNumber,
            currency: order.currency,
            value: getProductsValue(order.totalArs, order.shippingArs),
            shipping: order.shippingArs,
            coupon: order.couponCode ?? undefined,
            payment_type: order.paymentMethod,
            items: order.items.map((item) => ({
              item_id: item.productId ?? item.id,
              item_name: item.productNameSnapshot,
              item_category: "Productos",
              price: item.unitPriceArs,
              quantity: item.quantity,
            })),
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Analytics Measurement Protocol returned ${response.status}.`);
  }

  return true;
}
