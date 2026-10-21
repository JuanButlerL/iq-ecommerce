import { hasWholesaleAccess } from "@/features/wholesale/access";
import { createWholesaleLead } from "@/features/wholesale/leads";
import { getWholesaleContent } from "@/features/wholesale/queries";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    const content = await getWholesaleContent();

    if (!content.enabled || !(await hasWholesaleAccess(content))) {
      throw new AppError("Tu acceso a la sección mayorista venció. Recargá la página e ingresá la contraseña.", 403, true);
    }

    const payload = await request.json().catch(() => null);
    const result = await createWholesaleLead(payload, {
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return routeOk({ received: true, id: result.id });
  } catch (error) {
    return routeError(error);
  }
}
