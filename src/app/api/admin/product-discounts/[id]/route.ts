import { saveProductDiscount } from "@/features/product-discounts/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdminSection("discounts");
    const payload = await request.json();
    const { id } = await params;
    await saveProductDiscount(id, payload);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
