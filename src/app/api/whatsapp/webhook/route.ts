import { routeError, routeOk } from "@/lib/http/route";
import { handleWhatsappWebhook, verifyWhatsappWebhookSubscription } from "@/features/whatsapp/webhook-service";

// Meta valida el endpoint con un GET y espera el hub.challenge como texto plano.
export async function GET(request: Request) {
  try {
    const challenge = verifyWhatsappWebhookSubscription(new URL(request.url));
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const result = await handleWhatsappWebhook(request);
    return routeOk(result);
  } catch (error) {
    return routeError(error);
  }
}
