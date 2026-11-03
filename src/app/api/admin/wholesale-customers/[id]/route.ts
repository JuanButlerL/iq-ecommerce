import { updateWholesaleCustomer } from "@/features/wholesale/customers";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertAdminSection("wholesale");
    const { id } = await params;
    await updateWholesaleCustomer(id, await request.json());

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
