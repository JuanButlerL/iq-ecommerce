import { saveShippingRule } from "@/features/shipping/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertAdminSection("wholesale");
    const { id } = await params;
    await saveShippingRule(await request.json(), id, "WHOLESALE");

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
