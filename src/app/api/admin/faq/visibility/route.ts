import { setFaqVisibility } from "@/features/faq/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(request: Request) {
  try {
    await assertAdminSection("faq");
    await setFaqVisibility(await request.json());
    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
