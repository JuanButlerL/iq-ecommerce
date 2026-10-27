import { routeError, routeOk } from "@/lib/http/route";
import { assertWhatsappAdmin, recordSignupSession, signupSessionSchema } from "@/features/whatsapp/onboarding-service";

export async function POST(request: Request) {
  try {
    const session = await assertWhatsappAdmin();
    const input = signupSessionSchema.parse(await request.json());
    const connection = await recordSignupSession(input, session.adminUser.email);

    return routeOk({ connection });
  } catch (error) {
    return routeError(error);
  }
}
