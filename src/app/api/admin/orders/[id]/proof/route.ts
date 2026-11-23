import { z } from "zod";

import { approvePaymentProof, rejectPaymentProof } from "@/features/orders/services/proof-review-service";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ action: z.enum(["approve", "reject"]), reason: z.string().max(300).optional() });

// Aprobar o rechazar el comprobante de transferencia o eCheq de un pedido.
export async function POST(request: Request, { params }: Params) {
  try {
    const session = await assertAdminSection("orders");
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    if (body.action === "approve") {
      await approvePaymentProof(id, session.adminUser.email);
      return routeOk({ success: true });
    }
    return routeOk(await rejectPaymentProof(id, session.adminUser.email, body.reason ?? ""));
  } catch (error) {
    return routeError(error);
  }
}
