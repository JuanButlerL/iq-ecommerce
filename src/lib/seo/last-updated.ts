import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

// Latest edit to the public content (products, store settings, FAQ). Shown as the
// site's "updated" signal so search and AI engines can tell the content is maintained.
export const getSiteLastUpdatedAt = cache(async () => {
  const [products, settings, faqs] = await Promise.all([
    prisma.product.aggregate({ where: { active: true, visible: true }, _max: { updatedAt: true } }),
    prisma.storeSettings.findUnique({ where: { id: "default" }, select: { updatedAt: true } }),
    prisma.frequentlyAskedQuestion.aggregate({ where: { active: true }, _max: { updatedAt: true } }),
  ]);

  const dates = [products._max.updatedAt, settings?.updatedAt, faqs._max.updatedAt].filter(
    (date): date is Date => Boolean(date),
  );

  return dates.length > 0 ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
});
