import { NextResponse } from "next/server";

import { processNewsletterQueue } from "@/features/newsletter/send-service";
import { env } from "@/lib/env";
import { routeError, routeOk } from "@/lib/http/route";

// Separate from /api/cron/email-automations so a problem in one never blocks the other.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    if (!env.EMAIL_CRON_SECRET || token !== env.EMAIL_CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return routeOk(await processNewsletterQueue());
  } catch (error) {
    return routeError(error);
  }
}
