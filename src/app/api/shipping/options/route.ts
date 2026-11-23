import { NextResponse } from "next/server";

import { getCheckoutShippingOptions, shippingOptionsRequestSchema } from "@/features/logistics/quote-request";
import { routeError, routeOk } from "@/lib/http/route";
import { consumeRateLimits, getRequestIp } from "@/lib/security/rate-limit";

// Opciones de envío para el checkout. Cotiza contra Andreani/Correo (con caché), así que se limita por IP.
export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    const allowed = await consumeRateLimits([
      { scope: "shipping-options-ip", identifier: ip, limit: 60, windowSeconds: 10 * 60 },
      { scope: "shipping-options-ip-day", identifier: ip, limit: 600, windowSeconds: 24 * 60 * 60 },
    ]);
    if (!allowed) {
      return NextResponse.json({ error: "Demasiadas consultas. Probá de nuevo en unos minutos." }, { status: 429 });
    }
    const payload = shippingOptionsRequestSchema.parse(await request.json());
    return routeOk(await getCheckoutShippingOptions(payload));
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) {
      return NextResponse.json({ error: "Revisá el código postal y la provincia." }, { status: 400 });
    }
    return routeError(error);
  }
}
