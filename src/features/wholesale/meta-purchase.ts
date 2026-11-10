import type { Order, OrderItem } from "@prisma/client";

import { sendMetaConversionsApiEvent } from "@/lib/integrations/meta-conversions-api";
import { buildMetaPurchaseData } from "@/lib/meta-commerce";
import { buildWholesaleMetaPurchaseEventId } from "@/lib/meta-event-id";
import { WHOLESALE_META_CHANNEL, WHOLESALE_META_EVENTS } from "@/lib/wholesale-meta-events";

type RequestContext = {
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
};

export function wholesaleMetaPurchaseItems(items: Pick<OrderItem, "id" | "wholesaleProductId" | "productNameSnapshot" | "quantity" | "unitPriceArs">[]) {
  return items.map((item) => ({
    id: item.wholesaleProductId ?? item.id,
    name: item.productNameSnapshot,
    quantity: item.quantity,
    itemPrice: item.unitPriceArs,
  }));
}

// Compra mayorista por la API de conversiones: mismo id que el evento del navegador en /mayoristas/pedido.
export async function sendWholesaleMetaPurchase(order: Order & { items: OrderItem[] }, requestContext?: RequestContext) {
  await sendMetaConversionsApiEvent({
    eventName: WHOLESALE_META_EVENTS.purchase,
    eventId: buildWholesaleMetaPurchaseEventId(order.publicOrderNumber),
    eventSourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/mayoristas/pedido/${order.publicOrderNumber}`,
    clientIpAddress: requestContext?.clientIpAddress,
    clientUserAgent: requestContext?.clientUserAgent,
    userData: {
      email: order.customerEmail,
      phone: order.customerPhone,
      firstName: order.customerFirstName,
      lastName: order.customerLastName,
      city: order.locality,
      state: order.province,
      zip: order.postalCode,
      country: "ar",
    },
    customData: {
      ...buildMetaPurchaseData({
        orderNumber: order.publicOrderNumber,
        totalArs: order.totalArs,
        shippingArs: order.shippingArs,
        items: wholesaleMetaPurchaseItems(order.items),
      }),
      channel: WHOLESALE_META_CHANNEL,
    },
  }).catch((error) => {
    console.error("Meta Conversions API wholesale purchase event failed", error);
  });
}
