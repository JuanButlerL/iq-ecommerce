import { captureWelcomePopupLead, getWelcomePopupConfig } from "@/features/marketing/welcome-popup";
import { routeError, routeOk } from "@/lib/http/route";

export async function GET() {
  try {
    const config = await getWelcomePopupConfig();
    return routeOk(config, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const data = await captureWelcomePopupLead(await request.json(), request.headers.get("user-agent"));
    return routeOk(data);
  } catch (error) {
    return routeError(error);
  }
}
