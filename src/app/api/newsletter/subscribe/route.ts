import { NewsletterConsentSource } from "@prisma/client";

import { subscribeToNewsletter } from "@/features/email/newsletter-service";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";
import { newsletterSubscribeSchema } from "@/lib/validations/newsletter";

// Only records explicit consent. It never sends an email by itself.
export async function POST(request: Request) {
  try {
    const parsed = newsletterSubscribeSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Revisá tu email.", 400, true);
    }

    await subscribeToNewsletter(prisma, { email: parsed.data.email, source: NewsletterConsentSource.NEWSLETTER_PAGE });

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
