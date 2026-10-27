import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { routeError, routeOk } from "@/lib/http/route";

const recoveryItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    if (!token || token.length > 120) {
      return NextResponse.json({ error: "Link de carrito invalido." }, { status: 400 });
    }

    const lead = await prisma.cartRecoveryLead.findUnique({
      where: {
        recoveryToken: token,
      },
    });

    if (!lead || lead.status === "CONVERTED") {
      return NextResponse.json({ error: "Link de carrito no encontrado." }, { status: 404 });
    }

    const parsedItems = z.array(recoveryItemSchema).safeParse(lead.items);

    if (!parsedItems.success) {
      return NextResponse.json({ error: "El carrito guardado no se puede recuperar." }, { status: 409 });
    }

    const products = await prisma.product.findMany({
      where: {
        id: { in: parsedItems.data.map((item) => item.productId) },
        active: true,
        visible: true,
        manualSoldOut: false,
      },
      select: {
        id: true,
      },
    });
    const availableProductIds = new Set(products.map((product) => product.id));
    const items = parsedItems.data.filter((item) => availableProductIds.has(item.productId));

    if (!items.length) {
      return NextResponse.json({ error: "Los productos de este carrito ya no estan disponibles." }, { status: 409 });
    }

    return routeOk({
      email: lead.email,
      province: lead.province,
      items,
      freeShippingToken:
        lead.freeShippingToken &&
        !lead.freeShippingRedeemedAt &&
        lead.freeShippingExpiresAt &&
        lead.freeShippingExpiresAt > new Date()
          ? lead.freeShippingToken
          : null,
    });
  } catch (error) {
    return routeError(error);
  }
}
