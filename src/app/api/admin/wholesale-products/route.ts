import { createWholesaleProduct } from "@/features/wholesale/products";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST() {
  try {
    await assertAdminSection("wholesale");
    return routeOk(await createWholesaleProduct());
  } catch (error) {
    return routeError(error);
  }
}
