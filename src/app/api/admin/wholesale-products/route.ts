import { createWholesaleProduct } from "@/features/wholesale/products";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    await assertAdminSection("wholesale");
    const body = await request.json().catch(() => ({}));
    return routeOk(await createWholesaleProduct(body));
  } catch (error) {
    return routeError(error);
  }
}
