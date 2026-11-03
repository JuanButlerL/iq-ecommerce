import { revokeFreeShippingLink } from "@/features/free-shipping-links/service";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    await assertAdminSection("coupons");
    const { id } = await context.params;
    await revokeFreeShippingLink(id);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
