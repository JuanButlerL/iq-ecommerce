import { z } from "zod";

import { approveReferralCredit, voidReferralCredit } from "@/features/referrals/credits";
import { assertAdminSection } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";

const schema = z.object({
  action: z.enum(["approve", "force-approve", "void"]),
  note: z.string().trim().max(300).optional().default(""),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await assertAdminSection("referrals");
    const parsed = schema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      throw new AppError("Datos inválidos.", 400);
    }

    const { id } = await params;

    if (parsed.data.action === "void") {
      await voidReferralCredit(id, session.adminUser.email, parsed.data.note);
    } else {
      await approveReferralCredit(id, session.adminUser.email, parsed.data.action === "force-approve");
    }

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
