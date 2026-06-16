import { saveHomeFeaturedProductSlots } from "@/features/home-featured-products/mutations";
import { requireAdmin } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const payload = await request.json();
    await saveHomeFeaturedProductSlots(payload);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
