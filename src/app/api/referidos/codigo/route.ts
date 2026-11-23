import { createReferralCodes } from "@/features/referrals/portal";
import { getReferralSessionAccount } from "@/features/referrals/session";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";
import { isSameOriginRequest } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request, env.NEXT_PUBLIC_SITE_URL)) {
      throw new AppError("Origen no permitido.", 403);
    }

    const account = await getReferralSessionAccount();

    if (!account) {
      throw new AppError("Tu sesión venció. Volvé a entrar con tu DNI.", 401);
    }

    const payload = await request.json().catch(() => null);
    return routeOk(await createReferralCodes(account, payload));
  } catch (error) {
    return routeError(error);
  }
}
