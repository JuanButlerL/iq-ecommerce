import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

// The home renders per request, so scheduled slides appear/disappear on their own.
export const getActiveHomeSlides = cache(async () => {
  const now = new Date();

  return prisma.homeSlide.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
});

export async function getAdminHomeSlides() {
  return prisma.homeSlide.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}
