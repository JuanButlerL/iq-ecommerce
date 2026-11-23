import { NextResponse } from "next/server";

import { processEmailAutomations } from "@/features/email/automation-service";
import { processReferralCredits } from "@/features/referrals/jobs";
import { env } from "@/lib/env";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    if (!env.EMAIL_CRON_SECRET || token !== env.EMAIL_CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = await processEmailAutomations();
    // Referral credits ride on this cron; a failure there must not affect the email automations.
    const referrals = await processReferralCredits().catch((error) => {
      console.error("referral credits job failed", error);
      return null;
    });

    return routeOk({ results, referrals });
  } catch (error) {
    return routeError(error);
  }
}
