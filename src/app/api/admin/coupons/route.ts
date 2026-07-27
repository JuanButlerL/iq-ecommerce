import { saveCoupon } from "@/features/coupons/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    await assertAdminSection("coupons");
    const payload = await request.json();
    const result = await saveCoupon(payload);

    return routeOk({ success: true, ...result });
  } catch (error) {
    return routeError(error);
  }
}
