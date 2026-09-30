import { NewsletterAdminDashboard } from "@/features/newsletter/components/newsletter-admin-dashboard";
import { getAdminNewsletters, getNewsletterAdminSettings, getNewsletterAudienceSummary } from "@/features/newsletter/queries";
import { requireAdminSection } from "@/lib/auth/admin";
import { env } from "@/lib/env";

export default async function AdminNewsletterPage() {
  await requireAdminSection("newsletter");
  const [newsletters, audience, settings] = await Promise.all([getAdminNewsletters(), getNewsletterAudienceSummary(), getNewsletterAdminSettings()]);

  return (
    <NewsletterAdminDashboard
      newsletters={newsletters.map((newsletter) => ({
        ...newsletter,
        scheduledAt: newsletter.scheduledAt?.toISOString() ?? null,
        sendingStartedAt: newsletter.sendingStartedAt?.toISOString() ?? null,
        sentAt: newsletter.sentAt?.toISOString() ?? null,
        publishedAt: newsletter.publishedAt?.toISOString() ?? null,
        archivedAt: newsletter.archivedAt?.toISOString() ?? null,
        updatedAt: newsletter.updatedAt.toISOString(),
      }))}
      audience={audience}
      settings={settings}
      server={{
        newsletterSendingEnabled: env.newsletterSendingEnabled,
        canSendEmail: env.canSendEmail,
        isProduction: env.isProduction,
        batchSize: env.NEWSLETTER_BATCH_SIZE,
      }}
    />
  );
}
