import { consumeReferralLoginToken } from "@/features/referrals/access";
import { clearReferralSessionCookie, setReferralSessionCookie } from "@/features/referrals/session";
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
    const account = await consumeReferralLoginToken(payload, { ip: getRequestIp(request) });
    const response = routeOk({ success: true });
    setReferralSessionCookie(response, account);

    return response;
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request, env.NEXT_PUBLIC_SITE_URL)) {
    return routeError(new AppError("Origen no permitido.", 403));
  }

  const response = routeOk({ success: true });
  clearReferralSessionCookie(response);

  return response;
}
