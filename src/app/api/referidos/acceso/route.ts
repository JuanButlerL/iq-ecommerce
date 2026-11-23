import { requestReferralAccess } from "@/features/referrals/access";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";
import { getRequestIp, isSameOriginRequest } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request, env.NEXT_PUBLIC_SITE_URL)) {
      throw new AppError("Origen no permitido.", 403);
    }

    const payload = await request.json().catch(() => null);
    return routeOk(await requestReferralAccess(payload, { ip: getRequestIp(request) }));
  } catch (error) {
    return routeError(error);
  }
}
