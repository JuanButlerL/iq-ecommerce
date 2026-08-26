import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { routeError, routeOk } from "@/lib/http/route";

const ACTIVE_LEAD_WINDOW_HOURS = 24;

const cartRecoveryItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99),
});

const cartRecoverySchema = z.object({
  email: z.string().trim().email().max(180),
  province: z.string().trim().min(2).max(80).optional(),
  items: z.array(cartRecoveryItemSchema).min(1).max(20),
});

export async function POST(request: Request) {
  try {
    const parsed = cartRecoverySchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: "Datos de carrito invalidos." }, { status: 400 });
    }

    const email = parsed.data.email.toLowerCase();
    const quantityByProductId = new Map<string, number>();

    for (const item of parsed.data.items) {
      quantityByProductId.set(item.productId, (quantityByProductId.get(item.productId) ?? 0) + item.quantity);
    }

    const products = await prisma.product.findMany({
      where: {
        id: { in: Array.from(quantityByProductId.keys()) },
        active: true,
        visible: true,
        manualSoldOut: false,
      },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
      },
    });

    if (!products.length) {
      return NextResponse.json({ error: "El carrito no tiene productos disponibles." }, { status: 400 });
    }

    const items = products.map((product) => {
      const quantity = Math.min(quantityByProductId.get(product.id) ?? 1, 99);

      return {
        productId: product.id,
        quantity,
        productNameSnapshot: product.name,
        unitPriceArs: product.priceArs,
        lineTotalArs: product.priceArs * quantity,
        imageUrl: product.images[0]?.publicUrl ?? null,
      };
    });
    const subtotalArs = items.reduce((acc, item) => acc + item.lineTotalArs, 0);
    const existingLead = await prisma.cartRecoveryLead.findFirst({
      where: {
        email,
        status: { in: ["CAPTURED", "CHECKOUT_STARTED"] },
        updatedAt: {
          gte: new Date(Date.now() - ACTIVE_LEAD_WINDOW_HOURS * 60 * 60 * 1000),
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
    const recoveryToken = existingLead?.recoveryToken ?? randomUUID();
    const data = {
      email,
      recoveryToken,
      items,
      subtotalArs,
      province: parsed.data.province || null,
      status: "CAPTURED",
      checkoutOrderId: null,
      checkoutOrderNumber: null,
      checkoutStartedAt: null,
      userAgent: request.headers.get("user-agent"),
    };

    const lead = existingLead
      ? await prisma.cartRecoveryLead.update({
          where: { id: existingLead.id },
          data,
        })
      : await prisma.cartRecoveryLead.create({
          data,
        });
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const recoveryUrl = new URL(`/carrito?recuperar=${lead.recoveryToken}`, baseUrl).toString();

    return routeOk({
      email: lead.email,
      recoveryToken: lead.recoveryToken,
      recoveryUrl,
    });
  } catch (error) {
    return routeError(error);
  }
}
