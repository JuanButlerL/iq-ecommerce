import { SyncProvider } from "@prisma/client";

import type { OrderSyncPayload, OrderSyncProvider, OrderSyncResult } from "@/lib/integrations/sheets/types";

export class MockOrderSyncProvider implements OrderSyncProvider {
  readonly provider = SyncProvider.MOCK;

  async syncOrder(payload: OrderSyncPayload): Promise<OrderSyncResult> {
    return {
      success: true,
      provider: this.provider,
      requestPayload: payload,
      responsePayload: {
        mode: "mock",
        syncedAt: new Date().toISOString(),
      },
    };
  }
}
