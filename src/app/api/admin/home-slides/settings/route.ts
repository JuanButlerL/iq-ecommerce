import { slideAdminSection, slideChannelFromRequest } from "@/features/home-slides/lib/channel";
import { saveHomeCarouselSettings } from "@/features/home-slides/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(request: Request) {
  try {
    const channel = slideChannelFromRequest(request);
    await assertAdminSection(slideAdminSection(channel));
    const payload = await request.json();
    await saveHomeCarouselSettings(payload, channel);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
