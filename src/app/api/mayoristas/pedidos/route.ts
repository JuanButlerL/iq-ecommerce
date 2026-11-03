import { hasWholesaleAccess } from "@/features/wholesale/access";
import { createWholesaleOrder } from "@/features/wholesale/orders";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    const content = await getWholesaleContent();

    if (!content.enabled || !(await hasWholesaleAccess(content))) {
      throw new AppError("La sección mayorista no está disponible. Recargá la página.", 403, true);
    }

    const payload = await request.json().catch(() => null);

    return routeOk(await createWholesaleOrder(payload));
  } catch (error) {
    return routeError(error);
  }
}
