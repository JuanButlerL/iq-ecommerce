import { updateWholesaleLead } from "@/features/wholesale/leads";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertAdminSection("wholesale");
    const { id } = await params;
    await updateWholesaleLead(id, await request.json());

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
