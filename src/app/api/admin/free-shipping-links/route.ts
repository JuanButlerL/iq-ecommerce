import { createFreeShippingLinks } from "@/features/free-shipping-links/service";
import { assertAdminSection } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";
import { freeShippingLinkSchema } from "@/lib/validations/free-shipping-link";

export async function POST(request: Request) {
  try {
    const session = await assertAdminSection("coupons");
    const parsed = freeShippingLinkSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? "Datos inválidos.", 400, true);
    }

    const links = await createFreeShippingLinks({
      ...parsed.data,
      createdBy: session.adminUser.email,
    });

    return routeOk({ count: links.length });
  } catch (error) {
    return routeError(error);
  }
}
