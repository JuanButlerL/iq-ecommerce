import { requireAdmin } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";
import { archiveProduct, saveProduct } from "@/features/products/mutations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const payload = await request.json();
    const { id } = await params;
    await saveProduct(payload, id);

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
    await archiveProduct(id);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
