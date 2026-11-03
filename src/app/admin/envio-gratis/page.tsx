import { FreeShippingLinksPanel } from "@/features/admin/components/free-shipping-links-panel";
import { buildFreeShippingLinkUrl, getFreeShippingLinkStatus, listFreeShippingLinks } from "@/features/free-shipping-links/service";
import { requireAdminSection } from "@/lib/auth/admin";
import { env } from "@/lib/env";

export default async function AdminFreeShippingLinksPage() {
  await requireAdminSection("coupons");
  const links = await listFreeShippingLinks();
  const now = new Date();

  return (
    <FreeShippingLinksPanel
      links={links.map((link) => ({
        id: link.id,
        email: link.email,
        note: link.note,
        url: buildFreeShippingLinkUrl(link.token, env.NEXT_PUBLIC_SITE_URL),
        status: getFreeShippingLinkStatus(link, now),
        expiresAt: link.expiresAt,
        redeemedAt: link.redeemedAt,
        revokedAt: link.revokedAt,
        orderNumber: link.order?.publicOrderNumber ?? null,
        createdBy: link.createdBy,
        createdAt: link.createdAt,
      }))}
    />
  );
}
