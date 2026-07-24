import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";

export default async function ShortLinkRedirectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const link = await prisma.shortLink.findUnique({
    where: { slug },
    select: {
      id: true,
      targetUrl: true,
      active: true,
    },
  });

  if (!link || !link.active) {
    notFound();
  }

  await prisma.shortLink.update({
    where: { id: link.id },
    data: {
      clickCount: { increment: 1 },
      lastClickedAt: new Date(),
    },
  });

  redirect(link.targetUrl);
}
