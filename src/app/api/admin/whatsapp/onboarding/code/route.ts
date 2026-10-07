import { routeError, routeOk } from "@/lib/http/route";
import { assertWhatsappAdmin, recordSignupCode, signupCodeSchema } from "@/features/whatsapp/onboarding-service";

export async function POST(request: Request) {
  try {
    const session = await assertWhatsappAdmin();
    const input = signupCodeSchema.parse(await request.json());
    const connection = await recordSignupCode(input, session.adminUser.email);

    return routeOk({ connection });
  } catch (error) {
    return routeError(error);
  }
}
