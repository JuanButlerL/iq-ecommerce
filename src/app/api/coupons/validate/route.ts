import { getCouponPreview } from "@/features/coupons/queries";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const coupon = await getCouponPreview(body);

    return routeOk(coupon);
  } catch (error) {
    return routeError(error);
  }
}
