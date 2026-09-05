import { registerMarketingSession } from "@/features/marketing/attribution-service";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    await registerMarketingSession(payload);
    return routeOk({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
