import { NextResponse } from "next/server";
import { z } from "zod";

import { canUseCartRecoveryFreeShippingBenefit } from "@/features/cart-recovery/free-shipping-service";
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

    const eligible = await canUseCartRecoveryFreeShippingBenefit(parsed.data);
    return routeOk({ eligible });
  } catch (error) {
    return routeError(error);
  }
}
