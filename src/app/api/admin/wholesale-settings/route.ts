import { saveWholesaleSettings } from "@/features/wholesale/settings";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(request: Request) {
  try {
    await assertAdminSection("wholesale");
    await saveWholesaleSettings(await request.json());

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
