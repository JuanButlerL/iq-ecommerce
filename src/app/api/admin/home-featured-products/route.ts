import { saveHomeFeaturedProductSlots } from "@/features/home-featured-products/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(request: Request) {
  try {
    await assertAdminSection("home-products");
    const payload = await request.json();
    await saveHomeFeaturedProductSlots(payload);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
