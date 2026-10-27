import { routeError, routeOk } from "@/lib/http/route";
import { assertWhatsappAdmin, retryWhatsappConnection } from "@/features/whatsapp/onboarding-service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertWhatsappAdmin();
    const { id } = await params;
    const connection = await retryWhatsappConnection(id);

    return routeOk({ connection });
  } catch (error) {
    return routeError(error);
  }
}
