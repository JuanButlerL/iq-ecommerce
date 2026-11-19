import { SyncProvider } from "@prisma/client";

import { env, requireServerEnv } from "@/lib/env";
import type { OrderSyncPayload, OrderSyncProvider, OrderSyncResult } from "@/lib/integrations/sheets/types";

// Apps Script responde 200 aunque falle adentro (por ejemplo, "Lock timeout" cuando la planilla está ocupada):
// el error viene en el cuerpo como { ok: false, error }. Sin revisar el cuerpo, el pedido quedaba como
// sincronizado pero la planilla nunca recibía el cambio (ej. PROOF_UPLOADED).
const APPS_SCRIPT_TIMEOUT_MS = 45_000;

export class AppsScriptOrderSyncProvider implements OrderSyncProvider {
  readonly provider = SyncProvider.APPS_SCRIPT;

  async syncOrder(payload: OrderSyncPayload): Promise<OrderSyncResult> {
    const webhookUrl = requireServerEnv("APPS_SCRIPT_WEBHOOK_URL");

    let response: Response;

    try {
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.APPS_SCRIPT_API_KEY ? { "x-api-key": env.APPS_SCRIPT_API_KEY } : {}),
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(APPS_SCRIPT_TIMEOUT_MS),
      });
    } catch (error) {
      return {
        success: false,
        provider: this.provider,
        requestPayload: payload,
        responsePayload: null,
        errorMessage: `Apps Script no respondió: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    const responsePayload = await safeJson(response);

    return evaluateAppsScriptResponse(response.status, response.ok, responsePayload, payload, this.provider);
  }
}

export function evaluateAppsScriptResponse(
  status: number,
  httpOk: boolean,
  responsePayload: unknown,
  payload: OrderSyncPayload,
  provider: SyncProvider,
): OrderSyncResult {
  const fail = (errorMessage: string): OrderSyncResult => ({
    success: false,
    provider,
    requestPayload: payload,
    responsePayload,
    errorMessage,
  });

  if (!httpOk) {
    return fail(`Apps Script sync failed with status ${status}`);
  }

  if (!responsePayload || typeof responsePayload !== "object") {
    // Una página HTML (login de Google, error de Apps Script) también llega con 200.
    return fail("Apps Script respondió algo que no es JSON (¿deploy del script vencido o sin permisos?).");
  }

  const body = responsePayload as { ok?: unknown; error?: unknown };

  if (body.ok !== true) {
    return fail(`Apps Script devolvió error: ${typeof body.error === "string" ? body.error : JSON.stringify(responsePayload)}`);
  }

  return {
    success: true,
    provider,
    requestPayload: payload,
    responsePayload,
  };
}

async function safeJson(response: Response) {
  const text = await response.text().catch(() => "");

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
