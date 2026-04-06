import { deleteCoupon, saveCoupon } from "@/features/coupons/mutations";
import { requireAdmin } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const payload = await request.json();
    const { id } = await params;
    await saveCoupon(payload, id);

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
    await requireAdmin();
    const { id } = await params;
    await deleteCoupon(id);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
