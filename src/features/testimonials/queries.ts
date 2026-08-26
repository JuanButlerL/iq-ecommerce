import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

export const getActiveTestimonials = cache(async () => {
  return prisma.testimonial.findMany({
    where: {
      active: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
});

export async function getAdminTestimonials() {
  return prisma.testimonial.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}
