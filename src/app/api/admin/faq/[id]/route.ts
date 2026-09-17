import { deleteFaq, saveFaq } from "@/features/faq/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertAdminSection("faq");
    const { id } = await params;
    await saveFaq(await request.json(), id);
    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertAdminSection("faq");
    const { id } = await params;
    await deleteFaq(id);
    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
