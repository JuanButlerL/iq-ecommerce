import { env } from "@/lib/env";
import { AppsScriptOrderSyncProvider } from "@/lib/integrations/sheets/providers/apps-script";
import { GoogleSheetsOrderSyncProvider } from "@/lib/integrations/sheets/providers/google-sheets";
import { MockOrderSyncProvider } from "@/lib/integrations/sheets/providers/mock";

export function getOrderSyncProvider() {
  switch (env.ORDER_SYNC_PROVIDER) {
    case "apps_script":
      return new AppsScriptOrderSyncProvider();
    case "google_sheets":
      return new GoogleSheetsOrderSyncProvider();
    case "mock":
    default:
      return new MockOrderSyncProvider();
  }
}
