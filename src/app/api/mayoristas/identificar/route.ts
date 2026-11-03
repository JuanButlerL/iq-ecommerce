import { hasWholesaleAccess } from "@/features/wholesale/access";
import { identifyWholesaleCustomer } from "@/features/wholesale/identify";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    const content = await getWholesaleContent();

    if (!content.enabled || !(await hasWholesaleAccess(content))) {
      throw new AppError("La sección mayorista no está disponible. Recargá la página.", 403, true);
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const payload = await request.json().catch(() => null);

    return routeOk(await identifyWholesaleCustomer(payload, ip));
  } catch (error) {
    return routeError(error);
  }
}
