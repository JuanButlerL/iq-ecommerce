import { reorderWholesaleProducts } from "@/features/wholesale/products";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    await assertAdminSection("wholesale");
    await reorderWholesaleProducts(await request.json());

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
