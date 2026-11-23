import { NextResponse } from "next/server";

import { retryFailedOrderSyncs } from "@/features/orders/services/sync-service";
import { processPendingShipments } from "@/features/logistics/shipments";
import { env } from "@/lib/env";
import { routeError, routeOk } from "@/lib/http/route";

// Reenvía a la planilla los pedidos que no llegaron (ej. PROOF_UPLOADED con la planilla ocupada) y genera
// o reintenta las etiquetas de envío pendientes (corre cada 5 minutos). Usa el mismo secreto que los otros crons.
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    if (!env.EMAIL_CRON_SECRET || token !== env.EMAIL_CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sync = await retryFailedOrderSyncs();
    // Si la logística falla, el reenvío a la planilla igual queda hecho.
    const shipments = await processPendingShipments().catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));
    return routeOk({ ...sync, shipments });
  } catch (error) {
    return routeError(error);
  }
}
