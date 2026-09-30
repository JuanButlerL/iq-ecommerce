import { NewsletterDeliveryStatus } from "@prisma/client";
import { notFound } from "next/navigation";

import { NewsletterDeliveriesPanel } from "@/features/newsletter/components/newsletter-deliveries-panel";
import { getAdminNewsletter, getAdminNewsletterDeliveries } from "@/features/newsletter/queries";
import { requireAdminSection } from "@/lib/auth/admin";
import { env } from "@/lib/env";

type PageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ estado?: string }> };

export default async function AdminNewsletterDeliveriesPage({ params, searchParams }: PageProps) {
  await requireAdminSection("newsletter");
  const [{ id }, { estado }] = await Promise.all([params, searchParams]);
  const status = estado && estado in NewsletterDeliveryStatus ? (estado as NewsletterDeliveryStatus) : null;
  const [newsletter, deliveries] = await Promise.all([getAdminNewsletter(id), getAdminNewsletterDeliveries(id, status)]);

  if (!newsletter) {
    notFound();
  }

  return (
    <NewsletterDeliveriesPanel
      newsletter={{ id: newsletter.id, title: newsletter.title, status: newsletter.status, stats: newsletter.stats }}
      statusFilter={status}
      newsletterSendingEnabled={env.newsletterSendingEnabled}
      deliveries={deliveries.map((delivery) => ({
        ...delivery,
        firstOpenedAt: delivery.firstOpenedAt?.toISOString() ?? null,
        firstClickedAt: delivery.firstClickedAt?.toISOString() ?? null,
        reservedAt: delivery.reservedAt?.toISOString() ?? null,
        sentAt: delivery.sentAt?.toISOString() ?? null,
        createdAt: delivery.createdAt.toISOString(),
      }))}
      auditEvents={newsletter.auditEvents.map((event) => ({
        id: event.id,
        action: event.action,
        actorEmail: event.actorEmail,
        metadata: event.metadata,
        createdAt: event.createdAt.toISOString(),
      }))}
    />
  );
}
