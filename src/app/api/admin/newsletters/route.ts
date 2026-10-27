import { createNewsletter } from "@/features/newsletter/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST() {
  try {
    const session = await assertAdminSection("newsletter");
    const newsletter = await createNewsletter(session.adminUser.email);
    return routeOk({ id: newsletter.id });
  } catch (error) {
    return routeError(error);
  }
}
