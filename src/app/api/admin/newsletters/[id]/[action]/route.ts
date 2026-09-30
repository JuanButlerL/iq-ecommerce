import {
  approveNewsletterReview,
  cancelNewsletterSchedule,
  cancelRemainingDeliveries,
  duplicateNewsletter,
  pauseNewsletter,
  retryFailedDeliveries,
  resumeNewsletter,
  scheduleComplementarySend,
  scheduleNewsletter,
  setNewsletterVisibility,
} from "@/features/newsletter/mutations";
import { sendNewsletterTest } from "@/features/newsletter/send-service";
import { assertAdminSection } from "@/lib/auth/admin";
import { AppError } from "@/lib/errors/app-error";
import { routeError, routeOk } from "@/lib/http/route";

type RouteContext = { params: Promise<{ id: string; action: string }> };

async function readJson(request: Request) {
  const text = await request.text();
  return text ? (JSON.parse(text) as unknown) : {};
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await assertAdminSection("newsletter");
    const actor = session.adminUser.email;
    const { id, action } = await context.params;
    const body = await readJson(request);

    switch (action) {
      case "test":
        return routeOk(await sendNewsletterTest(id, actor));
      case "schedule":
        return routeOk(await scheduleNewsletter(id, body, actor));
      case "complementary":
        return routeOk(await scheduleComplementarySend(id, body, actor));
      case "cancel-schedule":
        await cancelNewsletterSchedule(id, actor);
        return routeOk({ success: true });
      case "approve-review":
        return routeOk(await approveNewsletterReview(id, body, actor));
      case "pause":
        await pauseNewsletter(id, actor);
        return routeOk({ success: true });
      case "resume":
        await resumeNewsletter(id, body, actor);
        return routeOk({ success: true });
      case "cancel-remaining":
        return routeOk(await cancelRemainingDeliveries(id, body, actor));
      case "duplicate": {
        const copy = await duplicateNewsletter(id, actor);
        return routeOk({ id: copy.id });
      }
      case "retry-errors":
        return routeOk(await retryFailedDeliveries(id, body, actor));
      case "visibility":
        await setNewsletterVisibility(id, body, actor);
        return routeOk({ success: true });
      default:
        throw new AppError("Acción desconocida.", 404, true);
    }
  } catch (error) {
    return routeError(error);
  }
}
