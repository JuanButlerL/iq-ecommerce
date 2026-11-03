import { hasWholesaleAccess } from "@/features/wholesale/access";
import { registerWholesaleCustomer } from "@/features/wholesale/registration";
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
    const result = await registerWholesaleCustomer(payload, {
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return routeOk(result);
  } catch (error) {
    return routeError(error);
  }
}
