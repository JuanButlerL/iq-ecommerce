import { NewsletterConsentSource, NewsletterSubscriberStatus, PrismaClient, type Prisma } from "@prisma/client";

export const NEWSLETTER_CONSENT_VERSION = "newsletter-v1";

type NewsletterDatabaseClient = PrismaClient | Prisma.TransactionClient;

export async function subscribeToNewsletter(
  db: NewsletterDatabaseClient,
  input: { email: string; source: NewsletterConsentSource },
) {
  const email = input.email.trim().toLowerCase();
  const consentedAt = new Date();

  return db.newsletterSubscriber.upsert({
    where: { email },
    update: {
      status: NewsletterSubscriberStatus.SUBSCRIBED,
      consentSource: input.source,
      consentVersion: NEWSLETTER_CONSENT_VERSION,
      consentedAt,
      unsubscribedAt: null,
    },
    create: {
      email,
      consentSource: input.source,
      consentVersion: NEWSLETTER_CONSENT_VERSION,
      consentedAt,
    },
  });
}
