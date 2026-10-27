import { NextResponse } from "next/server";
import { z } from "zod";

import { canUseCartRecoveryFreeShippingBenefit } from "@/features/cart-recovery/free-shipping-service";
import { canUseFreeShippingLink } from "@/features/free-shipping-links/service";
import { routeError, routeOk } from "@/lib/http/route";

const schema = z.object({
  token: z.string().uuid(),
  email: z.string().trim().email().max(180),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.coerce.number().int().min(1).max(99),
    }),
  ).min(1).max(20),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "No pudimos validar el beneficio de envío." }, { status: 400 });
    }

    // The checkout token is either a cart recovery benefit or a free shipping link from the admin.
    if (await canUseCartRecoveryFreeShippingBenefit(parsed.data)) {
      return routeOk({ eligible: true, source: "cart_recovery" });
    }

    if (await canUseFreeShippingLink(parsed.data)) {
      return routeOk({ eligible: true, source: "free_shipping_link" });
    }

    return routeOk({ eligible: false });
  } catch (error) {
    return routeError(error);
  }
}
