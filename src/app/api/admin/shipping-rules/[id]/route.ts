import { requireAdmin } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";
import { saveShippingRule } from "@/features/shipping/mutations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const payload = await request.json();
    const { id } = await params;
    await saveShippingRule(payload, id);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
