import type { SalesChannel } from "@prisma/client";
import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

// The home renders per request, so scheduled slides appear/disappear on their own.
// RETAIL = home de la tienda; WHOLESALE = slides que pasan después de la portada de /mayoristas.
export const getActiveHomeSlides = cache(async (channel: SalesChannel = "RETAIL") => {
  const now = new Date();

  return prisma.homeSlide.findMany({
    where: {
      channel,
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
});

export async function getAdminHomeSlides(channel: SalesChannel = "RETAIL") {
  return prisma.homeSlide.findMany({
    where: { channel },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}
