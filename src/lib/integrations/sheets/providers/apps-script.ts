import { SyncProvider } from "@prisma/client";

import { env, requireServerEnv } from "@/lib/env";
import type { OrderSyncPayload, OrderSyncProvider, OrderSyncResult } from "@/lib/integrations/sheets/types";

export class AppsScriptOrderSyncProvider implements OrderSyncProvider {
  readonly provider = SyncProvider.APPS_SCRIPT;

  async syncOrder(payload: OrderSyncPayload): Promise<OrderSyncResult> {
    const webhookUrl = requireServerEnv("APPS_SCRIPT_WEBHOOK_URL");

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.APPS_SCRIPT_API_KEY ? { "x-api-key": env.APPS_SCRIPT_API_KEY } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const responsePayload = await safeJson(response);

    if (!response.ok) {
      return {
        success: false,
        provider: this.provider,
        requestPayload: payload,
        responsePayload,
        errorMessage: `Apps Script sync failed with status ${response.status}`,
      };
    }

    return {
      success: true,
      provider: this.provider,
      requestPayload: payload,
      responsePayload,
    };
  }
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return await response.text();
  }
}
