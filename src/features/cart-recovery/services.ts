import { prisma } from "@/lib/db/prisma";

const ACTIVE_LEAD_WINDOW_HOURS = 24;

type OrderReference = {
  id: string;
  publicOrderNumber: string;
  customerEmail: string;
};

function activeLeadWindowStart() {
  return new Date(Date.now() - ACTIVE_LEAD_WINDOW_HOURS * 60 * 60 * 1000);
}

export async function markCartRecoveryCheckoutStarted(order: OrderReference) {
  await prisma.cartRecoveryLead.updateMany({
    where: {
      email: order.customerEmail.toLowerCase(),
      status: { in: ["CAPTURED", "CHECKOUT_STARTED"] },
      updatedAt: {
        gte: activeLeadWindowStart(),
      },
    },
    data: {
      status: "CHECKOUT_STARTED",
      checkoutOrderId: order.id,
      checkoutOrderNumber: order.publicOrderNumber,
      checkoutStartedAt: new Date(),
    },
  });
}

export async function markCartRecoveryConverted(order: OrderReference) {
  await prisma.cartRecoveryLead.updateMany({
    where: {
      email: order.customerEmail.toLowerCase(),
      status: { in: ["CAPTURED", "CHECKOUT_STARTED"] },
      updatedAt: {
        gte: activeLeadWindowStart(),
      },
    },
    data: {
      status: "CONVERTED",
      checkoutOrderId: order.id,
      checkoutOrderNumber: order.publicOrderNumber,
      checkoutStartedAt: new Date(),
      convertedOrderId: order.id,
      convertedOrderNumber: order.publicOrderNumber,
      convertedAt: new Date(),
    },
  });
}
