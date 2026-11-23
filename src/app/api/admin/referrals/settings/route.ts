import { saveReferralSettings } from "@/features/referrals/admin";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function PUT(request: Request) {
  try {
    await assertAdminSection("referrals");
    await saveReferralSettings(await request.json().catch(() => null));

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
