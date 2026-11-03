import { createWholesaleCustomer } from "@/features/wholesale/customers";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    await assertAdminSection("wholesale");
    return routeOk(await createWholesaleCustomer(await request.json()));
  } catch (error) {
    return routeError(error);
  }
}
