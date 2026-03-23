import { SyncProvider } from "@prisma/client";

import type { OrderSyncPayload, OrderSyncProvider, OrderSyncResult } from "@/lib/integrations/sheets/types";

export class GoogleSheetsOrderSyncProvider implements OrderSyncProvider {
  readonly provider = SyncProvider.GOOGLE_SHEETS;

  async syncOrder(payload: OrderSyncPayload): Promise<OrderSyncResult> {
    return {
      success: false,
      provider: this.provider,
      requestPayload: payload,
      errorMessage:
        "Google Sheets API provider requires service account wiring. Use Apps Script in the meantime or finish the provider credentials setup documented in README.",
    };
  }
}
