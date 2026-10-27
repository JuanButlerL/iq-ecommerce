import { reconcileNewsletterDelivery } from "@/features/newsletter/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

type RouteContext = { params: Promise<{ deliveryId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await assertAdminSection("newsletter");
    const { deliveryId } = await context.params;
    await reconcileNewsletterDelivery(deliveryId, await request.json(), session.adminUser.email);
    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
