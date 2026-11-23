import { buildReferralCreditsCsv } from "@/features/referrals/admin";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError } from "@/lib/http/route";

export async function GET() {
  try {
    await assertAdminSection("referrals");
    const csv = await buildReferralCreditsCsv();
    const date = new Date().toISOString().slice(0, 10);

    return new Response(`﻿${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="referidos-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
