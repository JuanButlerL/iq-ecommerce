import { removeNewsletter, saveNewsletter } from "@/features/newsletter/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await assertAdminSection("newsletter");
    const { id } = await context.params;
    const body = (await request.json()) as { content?: unknown; expectedUpdatedAt?: string | null; internalNotes?: unknown };
    const result = await saveNewsletter(id, body.content, session.adminUser.email, body.expectedUpdatedAt ?? null, body.internalNotes);

    return routeOk({ updatedAt: result.newsletter.updatedAt.toISOString(), contentHash: result.newsletter.contentHash, scheduleCancelled: result.scheduleCancelled });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await assertAdminSection("newsletter");
    const { id } = await context.params;
    return routeOk(await removeNewsletter(id, session.adminUser.email));
  } catch (error) {
    return routeError(error);
  }
}
