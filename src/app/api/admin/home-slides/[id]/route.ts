import { deleteHomeSlide, saveHomeSlide } from "@/features/home-slides/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdminSection("home-carousel");
    const payload = await request.json();
    const { id } = await params;
    await saveHomeSlide(payload, id);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdminSection("home-carousel");
    const { id } = await params;
    await deleteHomeSlide(id);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
