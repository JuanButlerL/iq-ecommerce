import type { Prisma, PrismaClient } from "@prisma/client";

type AuditDatabaseClient = PrismaClient | Prisma.TransactionClient;

export type NewsletterAuditAction =
  | "created"
  | "updated"
  | "duplicated"
  | "archived"
  | "deleted"
  | "visibility_changed"
  | "test_sent"
  | "scheduled"
  | "schedule_cancelled"
  | "moved_to_review"
  | "dispatch_started"
  | "dispatch_finished"
  | "paused"
  | "resumed"
  | "remaining_cancelled"
  | "complementary_scheduled"
  | "delivery_reconciled";

export async function recordNewsletterAudit(
  db: AuditDatabaseClient,
  input: { newsletterId: string; action: NewsletterAuditAction; actorEmail?: string | null; metadata?: Prisma.InputJsonValue },
) {
  await db.newsletterAuditEvent.create({
    data: {
      newsletterId: input.newsletterId,
      action: input.action,
      actorEmail: input.actorEmail ?? null,
      metadata: input.metadata,
    },
  });
}
