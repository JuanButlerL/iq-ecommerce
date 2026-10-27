import { importNewsletters } from "@/features/newsletter/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    const session = await assertAdminSection("newsletter");
    return routeOk(await importNewsletters(await request.json(), session.adminUser.email));
  } catch (error) {
    return routeError(error);
  }
}
