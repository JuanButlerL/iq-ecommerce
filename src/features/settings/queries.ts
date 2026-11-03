import { cache } from "react";
import type { SalesChannel } from "@prisma/client";

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

export async function getStoreSettingsForClient() {
  const settings = await getStoreSettings();

  if (!settings) {
    return null;
  }

  return {
    ...settings,
    bankTransferDiscountPercentage: Number(settings.bankTransferDiscountPercentage ?? 0),
  };
}

export async function getShippingRules(channel: SalesChannel = "RETAIL") {
  return prisma.shippingRule.findMany({
    where: { channel },
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
