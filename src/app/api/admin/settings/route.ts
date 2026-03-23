import { requireAdmin } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";
import { updateStoreSettings } from "@/features/settings/mutations";

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const payload = await request.json();
    await updateStoreSettings(payload);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
