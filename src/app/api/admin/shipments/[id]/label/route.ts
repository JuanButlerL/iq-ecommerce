import { NextResponse } from "next/server";

import { assertAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { routeError } from "@/lib/http/route";
import { createShippingLabelUrl } from "@/lib/storage/shipping-labels";

type Params = { params: Promise<{ id: string }> };

// Abre la etiqueta (URL firmada del bucket privado).
export async function GET(request: Request, { params }: Params) {
  try {
    await assertAdminSection("orders");
    const { id } = await params;
    const shipment = await prisma.shipment.findUnique({ where: { id }, select: { labelStoragePath: true } });
    if (!shipment?.labelStoragePath) return NextResponse.json({ error: "Este envío no tiene etiqueta." }, { status: 404 });
    const url = await createShippingLabelUrl(shipment.labelStoragePath);
    return NextResponse.redirect(new URL(url, request.url));
  } catch (error) {
    return routeError(error);
  }
}
