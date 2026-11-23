import { z } from "zod";

import { setReferralAccountBlocked } from "@/features/referrals/admin";
import { assertAdminSection } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";

const schema = z.object({ blocked: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await assertAdminSection("referrals");
    const parsed = schema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      throw new AppError("Datos inválidos.", 400);
    }

    const { id } = await params;
    await setReferralAccountBlocked(id, parsed.data.blocked, session.adminUser.email);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
