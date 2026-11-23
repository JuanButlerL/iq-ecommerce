import { NextResponse } from "next/server";
import { z } from "zod";

import { getCheckoutBranches } from "@/features/logistics/quote-request";
import { routeError, routeOk } from "@/lib/http/route";
import { consumeRateLimit, getRequestIp } from "@/lib/security/rate-limit";

const querySchema = z.object({
  carrier: z.enum(["ANDREANI", "CORREO_AR"]),
  postalCode: z.string().trim().regex(/^\d{4,8}$/),
  province: z.string().trim().min(2).max(80),
});

// Sucursales para retirar, por transportista y CP (guardadas una semana).
export async function GET(request: Request) {
  try {
    const allowed = await consumeRateLimit({ scope: "shipping-branches-ip", identifier: getRequestIp(request), limit: 60, windowSeconds: 10 * 60 });
    if (!allowed) return NextResponse.json({ error: "Demasiadas consultas. Probá de nuevo en unos minutos." }, { status: 429 });
    const url = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Revisá el código postal." }, { status: 400 });
    return routeOk(await getCheckoutBranches(parsed.data.carrier, parsed.data.postalCode, parsed.data.province));
  } catch (error) {
    return routeError(error);
  }
}
