import { NextResponse } from "next/server";

import { retryFailedOrderSyncs } from "@/features/orders/services/sync-service";
import { env } from "@/lib/env";
import { routeError, routeOk } from "@/lib/http/route";

// Reenvía a la planilla los pedidos que no llegaron (ej. PROOF_UPLOADED con la planilla ocupada).
// Usa el mismo secreto que los otros crons.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    if (!env.EMAIL_CRON_SECRET || token !== env.EMAIL_CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return routeOk(await retryFailedOrderSyncs());
  } catch (error) {
    return routeError(error);
  }
}
