import { notFound } from "next/navigation";

import { NewsletterEditor } from "@/features/newsletter/components/newsletter-editor";
import { getAdminNewsletter, getNewsletterAdminSettings } from "@/features/newsletter/queries";
import { countEligibleSubscribers } from "@/features/newsletter/send-service";
import { computeNewsletterContentHash } from "@/features/newsletter/content";
import { getNewsletterProductIds, loadNewsletterProducts, toNewsletterContent } from "@/features/newsletter/server-content";
import { getAdminTestimonials } from "@/features/testimonials/queries";
import { requireAdminSection } from "@/lib/auth/admin";
import { env } from "@/lib/env";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminNewsletterEditorPage({ params }: PageProps) {
  await requireAdminSection("newsletter");
  const { id } = await params;
  const newsletter = await getAdminNewsletter(id);

  if (!newsletter) {
    notFound();
  }

  const content = toNewsletterContent(newsletter);
  // Active catalog for the picker plus any product already used, even if it was paused later.
  const [activeProducts, usedProducts, settings, eligibleRecipients, testimonials] = await Promise.all([
    loadNewsletterProducts(),
    loadNewsletterProducts(getNewsletterProductIds(content)),
    getNewsletterAdminSettings(),
    countEligibleSubscribers(id),
    getAdminTestimonials(),
  ]);
  const products = { ...activeProducts, ...usedProducts };

  return (
    <NewsletterEditor
      newsletter={{
        id: newsletter.id,
        content,
        internalNotes: newsletter.internalNotes,
        status: newsletter.status,
        webVisible: newsletter.webVisible,
        archived: Boolean(newsletter.archivedAt),
        scheduledAt: newsletter.scheduledAt?.toISOString() ?? null,
        sendingStartedAt: newsletter.sendingStartedAt?.toISOString() ?? null,
        sentAt: newsletter.sentAt?.toISOString() ?? null,
        publishedAt: newsletter.publishedAt?.toISOString() ?? null,
        reviewReason: newsletter.reviewReason,
        approvedRecipientCount: newsletter.approvedRecipientCount,
        // Recomputed from the stored content so the editor never shows phantom "unsaved changes".
        contentHash: computeNewsletterContentHash(content),
        lastTestContentHash: newsletter.lastTestContentHash,
        lastTestSentAt: newsletter.lastTestSentAt?.toISOString() ?? null,
        updatedAt: newsletter.updatedAt.toISOString(),
        stats: newsletter.stats,
      }}
      products={Object.values(products)}
      testimonials={testimonials.map((item) => ({ id: item.id, name: item.name, roleLabel: item.roleLabel, quote: item.quote }))}
      settings={{ testRecipients: settings.testRecipients, senderName: settings.senderName, sectionEnabled: settings.sectionEnabled }}
      eligibleRecipients={eligibleRecipients}
      server={{ newsletterSendingEnabled: env.newsletterSendingEnabled, canSendEmail: env.canSendEmail, isProduction: env.isProduction, siteUrl: env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "") }}
    />
  );
}
