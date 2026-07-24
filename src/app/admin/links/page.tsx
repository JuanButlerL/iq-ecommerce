import { ShortLinksPanel } from "@/features/admin/components/short-links-panel";
import { requireAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

export default async function AdminLinksPage() {
  await requireAdminSection("links");
  const links = await prisma.shortLink.findMany({
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
  });

  return <ShortLinksPanel links={links} siteUrl={env.NEXT_PUBLIC_SITE_URL} />;
}
