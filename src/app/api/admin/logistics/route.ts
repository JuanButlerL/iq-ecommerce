import { z } from "zod";

import {
  addHoliday,
  assignPostalCodesZone,
  createZone,
  deleteHoliday,
  deleteZone,
  importPostalCodes,
  saveShippingSettings,
  saveWarehouse,
  searchPostalCodes,
  updateZone,
} from "@/features/logistics/admin";
import { assertAdminSection } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";

const actionSchema = z.object({ action: z.string(), id: z.string().uuid().optional(), data: z.unknown().optional() });

// Admin > Logística: configuración, zonas propias, feriados, depósitos y códigos postales.
export async function POST(request: Request) {
  try {
    await assertAdminSection("shipping");
    const { action, id, data } = actionSchema.parse(await request.json());
    const needId = () => {
      if (!id) throw new AppError("Falta el id.", 400, true);
      return id;
    };

    switch (action) {
      case "settings":
        await saveShippingSettings(data);
        return routeOk({ success: true });
      case "zone-create":
        return routeOk(await createZone(data));
      case "zone-update":
        return routeOk(await updateZone(needId(), data));
      case "zone-delete":
        await deleteZone(needId());
        return routeOk({ success: true });
      case "holiday-add":
        await addHoliday(data);
        return routeOk({ success: true });
      case "holiday-delete":
        await deleteHoliday(needId());
        return routeOk({ success: true });
      case "warehouse-save":
        return routeOk(await saveWarehouse(id ?? null, data));
      case "postal-import": {
        const text = z.object({ csv: z.string().min(10).max(5_000_000) }).parse(data).csv;
        return routeOk(await importPostalCodes(text));
      }
      case "postal-search":
        return routeOk(await searchPostalCodes(data));
      case "postal-assign":
        return routeOk(await assignPostalCodesZone(data));
      default:
        throw new AppError("Acción desconocida.", 400, true);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "Revisá los datos." }, { status: 400 });
    }
    return routeError(error);
  }
}
