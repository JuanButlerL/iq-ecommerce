import { z } from "zod";

import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";
import { processEmailAutomations } from "@/features/email/automation-service";

const processSchema = z.object({
  automationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function POST(request: Request) {
  try {
    await assertAdminSection("emails");
    const parsed = processSchema.parse(await request.json().catch(() => ({})));
    const results = await processEmailAutomations(parsed);

    return routeOk({ results });
  } catch (error) {
    return routeError(error);
  }
}
