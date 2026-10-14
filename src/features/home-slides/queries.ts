import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

export const getActiveHomeSlides = cache(async () => {
  return prisma.homeSlide.findMany({
    where: {
      active: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
});

export async function getAdminHomeSlides() {
  return prisma.homeSlide.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}
