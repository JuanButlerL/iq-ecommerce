import { reorderHomeSlides } from "@/features/home-slides/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    await assertAdminSection("home-carousel");
    const payload = await request.json();
    await reorderHomeSlides(payload);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
