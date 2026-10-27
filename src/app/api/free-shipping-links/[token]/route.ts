import { NextResponse } from "next/server";
import { z } from "zod";

import { getActiveFreeShippingLink } from "@/features/free-shipping-links/service";
import { routeError, routeOk } from "@/lib/http/route";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;

    if (!z.string().uuid().safeParse(token).success) {
      return NextResponse.json({ error: "Link inválido." }, { status: 404 });
    }

    const link = await getActiveFreeShippingLink(token);

    if (!link) {
      return NextResponse.json({ error: "El link de envío gratis venció o ya fue usado." }, { status: 404 });
    }

    return routeOk(link);
  } catch (error) {
    return routeError(error);
  }
}
