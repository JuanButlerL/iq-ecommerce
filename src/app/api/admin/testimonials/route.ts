import { saveTestimonial } from "@/features/testimonials/mutations";
import { assertAdminSection } from "@/lib/auth/admin";
import { routeError, routeOk } from "@/lib/http/route";

export async function POST(request: Request) {
  try {
    await assertAdminSection("testimonials");
    const payload = await request.json();
    await saveTestimonial(payload);

    return routeOk({ success: true });
  } catch (error) {
    return routeError(error);
  }
}
