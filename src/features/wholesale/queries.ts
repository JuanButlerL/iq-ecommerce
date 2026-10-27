import { cache } from "react";

import { DEFAULT_WHOLESALE_CONTENT, type WholesaleContent } from "@/features/wholesale/content";
import { prisma } from "@/lib/db/prisma";
import { wholesaleContentSchema } from "@/lib/validations/wholesale-page";

export const getWholesaleContent = cache(async (): Promise<WholesaleContent> => {
  const row = await prisma.wholesalePage.findUnique({ where: { id: "default" } });

  if (!row) {
    return DEFAULT_WHOLESALE_CONTENT;
  }

  const parsed = wholesaleContentSchema.safeParse(row.content);

  if (!parsed.success) {
    console.error("wholesale_page: contenido inválido, se usa el contenido por defecto.", parsed.error.issues[0]);
    return DEFAULT_WHOLESALE_CONTENT;
  }

  return parsed.data;
});
