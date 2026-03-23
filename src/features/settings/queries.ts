import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

export const getStoreSettings = cache(async () => {
  return prisma.storeSettings.findUnique({
    where: { id: "default" },
    include: {
      activeShippingRule: {
        include: {
          provinces: {
            orderBy: {
              provinceName: "asc",
            },
          },
        },
      },
    },
  });
});

export async function getShippingRules() {
  return prisma.shippingRule.findMany({
    include: {
      provinces: {
        orderBy: {
          provinceName: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}
