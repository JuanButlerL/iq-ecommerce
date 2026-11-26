import { slideAdminSection, slideChannelFromRequest } from "@/features/home-slides/lib/channel";
import { deleteHomeSlide, saveHomeSlide } from "@/features/home-slides/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const channel = slideChannelFromRequest(request);
    await assertAdminSection(slideAdminSection(channel));
    const payload = await request.json();
    const { id } = await params;
    await saveHomeSlide(payload, id, channel);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const channel = slideChannelFromRequest(request);
    await assertAdminSection(slideAdminSection(channel));
    const { id } = await params;
    await deleteHomeSlide(id, channel);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
