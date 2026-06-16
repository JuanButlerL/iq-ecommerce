import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

const homeFeaturedSlotInclude = {
  product: {
    include: {
      images: {
        orderBy: {
          sortOrder: "asc" as const,
        },
      },
    },
  },
};

export const getHomeFeaturedProductSlots = cache(async () => {
  const delegate = (prisma as typeof prisma & {
    homeFeaturedProductSlot?: {
      findMany: (args: {
        include: typeof homeFeaturedSlotInclude;
        orderBy: { slotOrder: "asc" };
      }) => Promise<unknown[]>;
    };
  }).homeFeaturedProductSlot;

  if (!delegate) {
    return [];
  }

  return delegate.findMany({
    include: homeFeaturedSlotInclude,
    orderBy: {
      slotOrder: "asc",
    },
  });
});

export async function getAdminHomeFeaturedProductSlots() {
  const delegate = (prisma as typeof prisma & {
    homeFeaturedProductSlot?: {
      findMany: (args: {
        include: typeof homeFeaturedSlotInclude;
        orderBy: { slotOrder: "asc" };
      }) => Promise<unknown[]>;
    };
  }).homeFeaturedProductSlot;

  if (!delegate) {
    return [];
  }

  return delegate.findMany({
    include: homeFeaturedSlotInclude,
    orderBy: {
      slotOrder: "asc",
    },
  });
}
