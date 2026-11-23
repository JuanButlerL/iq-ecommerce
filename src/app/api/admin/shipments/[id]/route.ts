import { z } from "zod";

import { attachManualLabel, cancelShipmentForOrder, retryShipmentNow, setManualTracking } from "@/features/logistics/shipments";
import { assertAdminSection } from "@/lib/auth/admin";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  action: z.enum(["retry", "tracking", "cancel"]),
  trackingNumber: z.string().max(60).optional(),
  reason: z.string().max(300).optional(),
});

// Acciones sobre el envío de un pedido: reintentar o generar ahora, cargar seguimiento a mano, cancelar, subir etiqueta.
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await assertAdminSection("orders");
    const actor = session.adminUser.email;
    const { id } = await params;
    const shipment = await prisma.shipment.findUnique({ where: { id }, select: { id: true, orderId: true } });
    if (!shipment) throw new AppError("Envío no encontrado.", 404, true);

    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("label");
      if (!(file instanceof File) || file.size === 0) throw new AppError("Elegí el PDF de la etiqueta.", 400, true);
      if (file.size > 5 * 1024 * 1024 || !/pdf|image/.test(file.type)) {
        throw new AppError("La etiqueta tiene que ser un PDF o una imagen de hasta 5 MB.", 400, true);
      }
      await attachManualLabel(id, file, actor);
      return routeOk({ success: true });
    }

    const body = bodySchema.parse(await request.json());
    try {
      if (body.action === "retry") {
        return routeOk({ success: true, result: await retryShipmentNow(id, actor) });
      }
      if (body.action === "tracking") {
        await setManualTracking(id, body.trackingNumber ?? "", actor);
        return routeOk({ success: true });
      }
    } catch (error) {
      // Errores de validación de las acciones (ej. "Este envío no se puede reintentar").
      if (error instanceof Error && !(error instanceof AppError)) throw new AppError(error.message, 400, true);
      throw error;
    }
    await cancelShipmentForOrder(shipment.orderId, actor, body.reason?.trim() || "Envío cancelado desde el admin.");
    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
