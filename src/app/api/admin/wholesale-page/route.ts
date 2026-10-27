import { saveWholesaleContent } from "@/features/wholesale/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(request: Request) {
  try {
    await assertAdminSection("wholesale");
    const payload = await request.json();
    await saveWholesaleContent(payload);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
