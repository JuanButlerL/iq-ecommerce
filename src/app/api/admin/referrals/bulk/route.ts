import { bulkCreateReferralCodes } from "@/features/referrals/admin";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    const session = await assertAdminSection("referrals");
    return routeOk(await bulkCreateReferralCodes(await request.json().catch(() => null), session.adminUser.email));
  } catch (error) {
    return routeError(error);
  }
}
