import { z } from "zod";

import { unsubscribeFromEmail } from "@/features/email/newsletter-service";
import { assertAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { routeError, routeOk } from "@/lib/http/route";

const schema = z.object({ email: z.string().trim().email("Ingresá un email válido.") });

export async function GET() {
  try {
    await assertAdminSection("emails");
    const suppressions = await prisma.newsletterSubscriber.findMany({
      where: { status: "UNSUBSCRIBED" },
      orderBy: { unsubscribedAt: "desc" },
      take: 100,
      select: { id: true, email: true, unsubscribedAt: true },
    });

    return routeOk({ suppressions });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    await assertAdminSection("emails");
    const { email } = schema.parse(await request.json());
    await unsubscribeFromEmail(prisma, email);
    return routeOk({ email: email.toLowerCase() });
  } catch (error) {
    return routeError(error);
  }
}
